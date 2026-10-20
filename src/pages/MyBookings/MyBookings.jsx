import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { machinesApi, bookingsApi } from '../../api';
import { userMessage } from '../../api/errors';
import { logError } from '../../utils/logger';
import { format, isSameDay, addDays, differenceInMinutes } from 'date-fns';
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
    <div className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-4 shadow-lg">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-bold text-[color:var(--card-title)]">Ore folosite per mașină</h3>

        {hasWashers && hasDryers && (
          <div className="flex gap-3 text-xs text-[color:var(--card-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--chart-washer)]" /> Spălat
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--chart-dryer)]" /> Uscat
            </span>
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const pct = (row.minutes / maxMinutes) * 100;
          const width = row.minutes > 0 ? Math.max(pct, 4) : 0;

          return (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="min-w-0 truncate text-sm font-bold text-[color:var(--card-title)]">
                  <MachineIcon type={row.type} size={18} className="inline-block align-[-4px] mr-1.5" />
                  {row.name}
                </span>
                <span className="shrink-0 text-sm font-bold text-[color:var(--card-title)]">
                  {row.minutes > 0 ? formatDuration(row.minutes) : '0h'}
                </span>
              </div>

              <div
                className="h-3 w-full rounded-full bg-[color:var(--card-icon-bg)] overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                    row.type === 'dryer' ? 'bg-[color:var(--chart-dryer)]' : 'bg-[color:var(--chart-washer)]'
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
  <div className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-4 shadow-lg">
    <p className="text-xs text-[color:var(--card-muted)] mb-1">{label}</p>
    <p className="text-xl font-extrabold text-[color:var(--card-title)] leading-tight">{value}</p>
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

  const upcoming = useMemo(
    () => bookings.filter((b) => b.end > now).sort((a, b) => a.start - b.start),
    [bookings, now]
  );

  const upcomingByDay = useMemo(() => {
    const groups = [];
    upcoming.forEach((b) => {
      const last = groups[groups.length - 1];
      if (last && isSameDay(last.date, b.start)) last.items.push(b);
      else groups.push({ date: b.start, items: [b] });
    });
    return groups;
  }, [upcoming]);

  const stats = useMemo(() => {
    const minutesById = {};
    let sessions = 0;

    bookings.forEach((b) => {
      if (b.start >= now) return;
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
        await bookingsApi.release(pending.booking.id);
      } else {
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
    return <div className="text-center text-[color:var(--on-bg)] mt-10 font-bold">se incarca.</div>;
  }

  const renderCard = (b) => {
    const machine = machines[b.machineId];
    const inProgress = b.start <= now;
    const minutesToStart = differenceInMinutes(b.start, now);
    const minutesLeft = differenceInMinutes(b.end, now);

    let status = null;
    if (inProgress) status = { text: `În desfășurare · încă ${formatDuration(Math.max(minutesLeft, 1))}`, color: 'var(--ok)' };
    else if (minutesToStart < 24 * 60) status = { text: `Începe în ${formatDuration(Math.max(minutesToStart, 1))}`, color: 'var(--timer)' };

    const kind = inProgress ? 'release' : 'cancel';

    return (
      <li
        key={b.id}
        className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-4 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 rounded-full bg-[color:var(--card-icon-bg)] flex items-center justify-center text-[color:var(--card-title)] shadow-inner">
            <MachineIcon type={machine?.type} size={26} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[color:var(--card-title)] truncate">
              {machine?.name ?? 'Mașină ștearsă'}
            </h3>
            <p className="text-sm text-[color:var(--card-muted)]">
              <span className="font-bold">
                {format(b.start, 'HH:mm')} - {format(b.end, 'HH:mm')}
              </span>
              <span> · {formatDuration(differenceInMinutes(b.end, b.start))}</span>
            </p>
          </div>
        </div>

        {status && (
          <p className="mt-3 text-xs font-bold" style={{ color: status.color }}>
            {status.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => { setActionError(null); setPending({ booking: b, kind }); }}
          className={`mt-3 w-full py-2.5 rounded-xl text-sm font-bold border-2 transition active:scale-[0.98] ${
            kind === 'release'
              ? 'border-[color:var(--btn-bg)] text-[color:var(--card-title)]'
              : 'border-[color:var(--cal-danger)] text-[color:var(--cal-danger)]'
          }`}
        >
          {kind === 'release' ? 'Eliberează mașina' : 'Anulează rezervarea'}
        </button>
      </li>
    );
  };

  const emptyState = (text) => (
    <div className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-6 text-center shadow-lg">
      <p className="text-[color:var(--card-muted)] mb-4">{text}</p>
      <button
        type="button"
        onClick={onGoToMachines}
        className="px-5 py-3 rounded-xl font-bold text-white bg-[color:var(--btn-bg)] hover:bg-[color:var(--btn-hover)] active:bg-[color:var(--btn-active)] transition-colors"
      >
        Rezervă o mașină
      </button>
    </div>
  );

  const copy = pending ? CONFIRM_COPY[pending.kind] : null;

  return (
    <div className="w-full flex flex-col gap-4 lg:max-w-3xl lg:mx-auto">
      <h2 className="text-xl font-bold text-[color:var(--on-bg)] drop-shadow-sm px-2">
        Rezervările mele
      </h2>

      <SegmentedTabs
        label="Rezervări și statistici"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: 'Viitoare', badge: upcoming.length },
          { value: 'stats', label: 'Statistici' },
        ]}
      />

      {/* ---------- Viitoare ---------- */}
      {tab === 'upcoming' && (
        upcomingByDay.length === 0 ? (
          emptyState('Nu ai nicio rezervare viitoare.')
        ) : (
          upcomingByDay.map((group) => (
            <section key={group.date.toDateString()}>
              <h3 className="text-sm font-bold text-[color:var(--on-bg-muted)] capitalize px-2 mb-2">
                {dayLabel(group.date, now)}
                <span className="font-normal"> · {format(group.date, 'dd MMM', { locale: ro })}</span>
              </h3>
              <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">{group.items.map(renderCard)}</ul>
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
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Timp total folosit" value={formatDuration(stats.totalMinutes)} />
              <StatTile label="Rezervări folosite" value={stats.sessions} />
            </div>

            <UsageChart rows={stats.rows} />

            {stats.top && (
              <p className="text-center text-sm text-[color:var(--on-bg-muted)] px-2">
                Cea mai folosită: <span className="font-bold text-[color:var(--on-bg)]">{stats.top.name}</span>
              </p>
            )}
          </>
        )
      )}

      {/* Fereastra de confirmare */}
      {pending && copy && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color:var(--cal-overlay)] backdrop-blur-sm"
          onClick={() => !busy && setPending(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl p-6 bg-[color:var(--card-bg)] border border-[color:var(--card-border)] shadow-2xl text-[color:var(--card-title)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-extrabold mb-1">{copy.title}</h3>
            <p className="text-sm text-[color:var(--card-muted)] mb-1">{copy.text}</p>
            <p className="text-sm font-bold mb-5">
              {machines[pending.booking.machineId]?.name ?? 'Mașină ștearsă'}
              {' · '}
              {format(pending.booking.start, 'dd MMM', { locale: ro })}, {format(pending.booking.start, 'HH:mm')} - {format(pending.booking.end, 'HH:mm')}
            </p>

            {actionError && (
              <p role="alert" className="text-sm font-bold text-[color:var(--cal-danger)] mb-3">
                {actionError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="flex-1 py-3 rounded-xl font-bold border-2 border-[color:var(--cal-ghost-border)] text-[color:var(--cal-ghost-text)] disabled:opacity-50"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runAction}
                className={`flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-50 ${
                  copy.danger ? 'bg-[color:var(--cal-danger)]' : 'bg-[color:var(--btn-bg)]'
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
