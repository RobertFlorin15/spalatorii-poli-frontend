import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { machinesApi, bookingsApi } from '../../api';
import { userMessage } from '../../api/errors';
import { logError } from '../../utils/logger';
import { format, isSameDay, addDays, subDays, differenceInMinutes } from 'date-fns';
import ro from 'date-fns/locale/ro';
import MachineIcon from '../../components/MachineIcon/MachineIcon';
import SegmentedTabs from '../../components/SegmentedTabs/SegmentedTabs';
import './MyBookings.scss';

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}min`].filter(Boolean).join(' ') || '0min';
};

const dayLabel = (date, now) => {
  if (isSameDay(date, now)) return 'Azi';
  if (isSameDay(date, addDays(now, 1))) return 'Mâine';
  if (isSameDay(date, subDays(now, 1))) return 'Ieri';
  return format(date, 'EEEE, dd MMMM', { locale: ro });
};

// Textele ferestrei de confirmare, în funcție de acțiune
const CONFIRM_COPY = {
  cancel: {
    title: 'Anulezi rezervarea?',
    text: 'Intervalul devine liber pentru ceilalți.',
    confirm: 'Da, anulează',
    cancel: 'Păstrează',
    danger: true,
  },
  release: {
    title: 'Eliberezi mașina acum?',
    text: 'Rezervarea se încheie imediat, iar mașina devine disponibilă.',
    confirm: 'Da, eliberează',
    cancel: 'Nu încă',
    danger: false,
  },
};

/* ---------------------------------------------------------
   Grafic: ore folosite per mașină (bare orizontale)
   --------------------------------------------------------- */
const UsageChart = ({ rows }) => {
  const [mounted, setMounted] = useState(false);

  // Barele cresc de la 0 la valoarea lor, la afișare
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const maxMinutes = Math.max(...rows.map((r) => r.minutes), 1);
  const hasWashers = rows.some((r) => r.type === 'washer');
  const hasDryers = rows.some((r) => r.type === 'dryer');

  return (
    <div className="my-bookings__chart">
      <div className="my-bookings__chart-header">
        <h3 className="my-bookings__chart-title">Ore folosite per mașină</h3>

        {hasWashers && hasDryers && (
          <div className="my-bookings__chart-legend">
            <span className="my-bookings__chart-legend-item">
              <span className="my-bookings__chart-dot my-bookings__chart-dot--washer" /> Spălat
            </span>
            <span className="my-bookings__chart-legend-item">
              <span className="my-bookings__chart-dot my-bookings__chart-dot--dryer" /> Uscat
            </span>
          </div>
        )}
      </div>

      <ul className="my-bookings__chart-list">
        {rows.map((row) => {
          const pct = (row.minutes / maxMinutes) * 100;
          const width = row.minutes > 0 ? Math.max(pct, 4) : 0;

          return (
            <li key={row.id}>
              <div className="my-bookings__chart-row-head">
                <span className="my-bookings__chart-row-name">
                  <MachineIcon type={row.type} size={18} className="my-bookings__chart-row-icon" />
                  {row.name}
                </span>
                <span className="my-bookings__chart-row-val">
                  {row.minutes > 0 ? formatDuration(row.minutes) : '0h'}
                </span>
              </div>

              <div className="my-bookings__chart-track" aria-hidden="true">
                <div
                  className={`my-bookings__chart-bar ${
                    row.type === 'dryer' ? 'my-bookings__chart-bar--dryer' : 'my-bookings__chart-bar--washer'
                  }`}
                  style={{ width: mounted ? `${width}%` : '0%' }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const StatTile = ({ label, value }) => (
  <div className="my-bookings__stat-tile">
    <p className="my-bookings__stat-label">{label}</p>
    <p className="my-bookings__stat-value">{value}</p>
  </div>
);

/* --------------------------------------------------------- */

const MyBookings = ({ onGoToMachines }) => {
  const [bookings, setBookings] = useState([]);
  const [machines, setMachines] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [now, setNow] = useState(new Date());
  const [pending, setPending] = useState(null); // { booking, kind }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Actualizăm "acum" în fiecare minut
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Mașinile (id -> {name, type})
  useEffect(() => {
    // CE SE CERE DE LA BACKEND:
    // - Lista mașinilor din Firestore (pentru a afișa numele și tipul mașinii în istoric și grafic)
    // CE SE TRIMITE CĂTRE BACKEND:
    // - Listener pe colecția 'machines'
    const unsub = machinesApi.subscribe(
      (list) => {
        const map = {};
        list.forEach((m) => { map[m.id] = m; });
        setMachines(map);
      },
      (error) => logError('machines', error)
    );
    return () => unsub();
  }, []);

  // Rezervările utilizatorului curent (serverul îl știe din sesiune, nu îl trimitem noi)
  useEffect(() => {
    // CE SE CERE DE LA BACKEND:
    // - Rezervările proprii ale studentului logat (unde userId == uid-ul curent)
    // CE SE TRIMITE CĂTRE BACKEND:
    // - Query filter pe 'bookings' cu userId-ul din sesiune
    const unsub = bookingsApi.subscribeMyBookings(
      (list) => {
        setBookings(list);
        setLoading(false);
      },
      (error) => {
        logError('my-bookings', error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => b.start - a.start),
    [bookings]
  );

  const bookingsByDay = useMemo(() => {
    const groups = [];
    sortedBookings.forEach((b) => {
      const last = groups[groups.length - 1];
      if (last && isSameDay(last.date, b.start)) last.items.push(b);
      else groups.push({ date: b.start, items: [b] });
    });
    return groups;
  }, [sortedBookings]);

  const stats = useMemo(() => {
    const minutesById = {};
    let sessions = 0;

    bookings.forEach((b) => {
      if (b.status === 'cancelled' || b.start >= now) return;
      const usedEnd = b.end < now ? b.end : now;
      const minutes = Math.round((usedEnd - b.start) / 60000);
      if (minutes <= 0) return;
      minutesById[b.machineId] = (minutesById[b.machineId] || 0) + minutes;
      sessions += 1;
    });

    // toate mașinile existente (și cele cu 0 ore), plus eventuale mașini șterse
    const ids = new Set([...Object.keys(machines), ...Object.keys(minutesById)]);
    const rows = [...ids]
      .map((id) => ({
        id,
        name: machines[id]?.name ?? 'Mașină ștearsă',
        type: machines[id]?.type ?? null,
        minutes: minutesById[id] || 0,
      }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'ro'));

    const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);
    return { rows, totalMinutes, sessions, top: rows[0]?.minutes > 0 ? rows[0] : null };
  }, [bookings, machines, now]);

  const runAction = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'release') {
        // CE SE TRIMITE CĂTRE BACKEND:
        // - ID-ul rezervării către bookingsApi.release: updateDoc cu endTime = serverTimestamp()
        // CE SE CERE DE LA BACKEND:
        // - Confirmarea actualizării orei de sfârșit (eliberare imediată)
        await bookingsApi.release(pending.booking.id);
      } else {
        // CE SE TRIMITE CĂTRE BACKEND:
        // - ID-ul rezervării către bookingsApi.cancel: deleteDoc pe 'bookings/{id}'
        // CE SE CERE DE LA BACKEND:
        // - Confirmarea ștergerii rezervării
        await bookingsApi.cancel(pending.booking.id);
      }
      setPending(null);
    } catch (error) {
      logError('booking:action', error);
      setActionError(userMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="my-bookings__loading">se incarca.</div>;
  }

  const renderCard = (b) => {
    const machine = machines[b.machineId];
    const isCancelled = b.status === 'cancelled';
    const isPast = !isCancelled && b.end <= now;
    const inProgress = !isCancelled && b.start <= now && b.end > now;
    const minutesToStart = differenceInMinutes(b.start, now);
    const minutesLeft = differenceInMinutes(b.end, now);

    let status = null;
    if (isCancelled) {
      status = { text: 'Programare anulată', mod: 'cancelled' };
    } else if (isPast) {
      status = { text: 'Finalizată', mod: 'done' };
    } else if (inProgress) {
      status = { text: `În desfășurare · încă ${formatDuration(Math.max(minutesLeft, 1))}`, mod: 'active' };
    } else if (minutesToStart < 24 * 60) {
      status = { text: `Începe în ${formatDuration(Math.max(minutesToStart, 1))}`, mod: 'soon' };
    }

    const kind = inProgress ? 'release' : 'cancel';

    return (
      <li
        key={b.id}
        className={`my-bookings__card ${
          isCancelled ? 'my-bookings__card--cancelled' : isPast ? 'my-bookings__card--past' : ''
        }`}
      >
        <div className="my-bookings__card-top">
          <div className="my-bookings__card-icon">
            <MachineIcon type={machine?.type} size={26} />
          </div>

          <div className="my-bookings__card-info">
            <h3 className="my-bookings__card-name">
              {machine?.name ?? 'Mașină ștearsă'}
            </h3>
            <p className="my-bookings__card-time">
              <span className="my-bookings__card-hours">
                {format(b.start, 'HH:mm')} - {format(b.end, 'HH:mm')}
              </span>
              <span> · {formatDuration(differenceInMinutes(b.end, b.start))}</span>
            </p>
          </div>
        </div>

        {status && (
          <p className={`my-bookings__card-status my-bookings__card-status--${status.mod}`}>
            {status.text}
          </p>
        )}

        {isCancelled && (
          <div className="my-bookings__card-reason">
            <span className="my-bookings__card-reason-label">Motiv anulare:</span>{' '}
            <span className="my-bookings__card-reason-text">
              {b.cancelReason || 'Nespecificat'}
            </span>
          </div>
        )}

        {!isCancelled && !isPast && (
          <button
            type="button"
            onClick={() => { setActionError(null); setPending({ booking: b, kind }); }}
            className={`my-bookings__card-btn my-bookings__card-btn--${kind}`}
          >
            {kind === 'release' ? 'Eliberează mașina' : 'Anulează rezervarea'}
          </button>
        )}
      </li>
    );
  };

  const emptyState = (text) => (
    <div className="my-bookings__empty">
      <p className="my-bookings__empty-text">{text}</p>
      <button
        type="button"
        onClick={onGoToMachines}
        className="my-bookings__empty-btn"
      >
        Rezervă o mașină
      </button>
    </div>
  );

  const copy = pending ? CONFIRM_COPY[pending.kind] : null;

  return (
    <div className="my-bookings">
      <h2 className="my-bookings__title">
        Rezervările mele
      </h2>

      <SegmentedTabs
        label="Rezervări și statistici"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: 'Programări', badge: sortedBookings.length },
          { value: 'stats', label: 'Statistici' },
        ]}
      />

      {/* ---------- Programări ---------- */}
      {tab === 'upcoming' && (
        bookingsByDay.length === 0 ? (
          emptyState('Nu ai nicio rezervare înregistrată.')
        ) : (
          bookingsByDay.map((group) => (
            <section key={group.date.toDateString()}>
              <h3 className="my-bookings__day-heading">
                {dayLabel(group.date, now)}
                <span className="my-bookings__day-date"> · {format(group.date, 'dd MMM', { locale: ro })}</span>
              </h3>
              <ul className="my-bookings__list">{group.items.map(renderCard)}</ul>
            </section>
          ))
        )
      )}

      {/* ---------- Statistici ---------- */}
      {tab === 'stats' && (
        stats.totalMinutes === 0 ? (
          emptyState('Statisticile apar după prima ta utilizare a unei mașini.')
        ) : (
          <>
            <div className="my-bookings__stats-grid">
              <StatTile label="Timp total folosit" value={formatDuration(stats.totalMinutes)} />
              <StatTile label="Rezervări folosite" value={stats.sessions} />
            </div>

            <UsageChart rows={stats.rows} />

            {stats.top && (
              <p className="my-bookings__top-machine">
                Cea mai folosită: <span className="my-bookings__top-machine-name">{stats.top.name}</span>
              </p>
            )}
          </>
        )
      )}

      {/* Fereastra de confirmare */}
      {pending && copy && createPortal(
        <div
          className="my-bookings__overlay"
          onClick={() => !busy && setPending(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="my-bookings__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="my-bookings__modal-title">{copy.title}</h3>
            <p className="my-bookings__modal-text">{copy.text}</p>
            <p className="my-bookings__modal-meta">
              {machines[pending.booking.machineId]?.name ?? 'Mașină ștearsă'}
              {' · '}
              {format(pending.booking.start, 'dd MMM', { locale: ro })}, {format(pending.booking.start, 'HH:mm')} - {format(pending.booking.end, 'HH:mm')}
            </p>

            {actionError && (
              <p role="alert" className="my-bookings__modal-error">
                {actionError}
              </p>
            )}

            <div className="my-bookings__modal-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="my-bookings__modal-btn my-bookings__modal-btn--ghost"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runAction}
                className={`my-bookings__modal-btn ${
                  copy.danger ? 'my-bookings__modal-btn--danger' : 'my-bookings__modal-btn--primary'
                }`}
              >
                {busy ? 'Se salvează...' : copy.confirm}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MyBookings;
