import { useState, useEffect, useMemo } from 'react';
import {
  FiChevronDown,
  FiChevronUp,
  FiMinus,
  FiPlus,
  FiTool,
  FiSliders,
  FiClock,
  FiCalendar,
} from 'react-icons/fi';
import { addDays, format, differenceInMinutes, isSameDay } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { machinesApi, bookingsApi, maintenanceApi, settingsApi } from '../../api';
import { userMessage } from '../../api/errors';
import { logError } from '../../utils/logger';
import { useSettings } from '../../hooks/useSettings';
import MachineIcon from '../../components/MachineIcon/MachineIcon';
import {
  validateSettings, SLOT_MINUTES, DEFAULT_SETTINGS, formatClock, formatDuration,
} from '../../utils/settingsModel';
import './AdminPanel.scss';

// Opțiunile din liste: din 30 în 30 de minute
const OPEN_OPTIONS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES);
const CLOSE_OPTIONS = OPEN_OPTIONS.map((m) => m + SLOT_MINUTES);

const formatIsoDateRo = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const formatMaintDateRange = (startDate, endDate) => {
  const startLabel = formatIsoDateRo(startDate);
  if (!endDate || endDate === startDate) return startLabel;
  return `${startLabel} - ${formatIsoDateRo(endDate)}`;
};

/**
 * Grupează butoanele de timp selectate în intervale contigue [startMinutes, endMinutes].
 */
const buildMaintenanceRanges = (selectedTimes, closeMinutes) => {
  if (!Array.isArray(selectedTimes) || selectedTimes.length === 0) return [];
  const sorted = [...new Set(selectedTimes)].sort((a, b) => a - b);
  const groups = [];

  sorted.forEach((t) => {
    const last = groups[groups.length - 1];
    if (last && t === last[last.length - 1] + SLOT_MINUTES) {
      last.push(t);
    } else {
      groups.push([t]);
    }
  });

  return groups.map((g) => {
    const first = g[0];
    const last = g[g.length - 1];
    if (g.length > 1 && last === closeMinutes) {
      return { startMinutes: first, endMinutes: closeMinutes };
    }
    if (g.length === 1 && first === closeMinutes) {
      return {
        startMinutes: Math.max(0, closeMinutes - SLOT_MINUTES),
        endMinutes: closeMinutes,
      };
    }
    return {
      startMinutes: first,
      endMinutes: Math.min(24 * 60, last + SLOT_MINUTES),
    };
  });
};

const Card = ({ children }) => (
  <section className="admin-panel__card">
    {children}
  </section>
);

const ToggleSwitch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`admin-panel__switch ${checked ? 'admin-panel__switch--on' : ''}`}
  >
    <span className={`admin-panel__switch-thumb ${checked ? 'admin-panel__switch-thumb--on' : ''}`} />
  </button>
);

const AdminPanel = () => {
  const { isAdmin } = useAuth();
  const {
    openMinutes,
    closeMinutes,
    maxSlots,
    maxWasherSlotsPerDay,
    maxDryerSlotsPerDay,
    blockPastSlots,
    maxAdvanceDays,
    loading,
  } = useSettings();

  const saved = useMemo(
    () => ({
      openMinutes,
      closeMinutes,
      maxSlots,
      maxWasherSlotsPerDay,
      maxDryerSlotsPerDay,
      blockPastSlots,
      maxAdvanceDays,
    }),
    [
      openMinutes,
      closeMinutes,
      maxSlots,
      maxWasherSlotsPerDay,
      maxDryerSlotsPerDay,
      blockPastSlots,
      maxAdvanceDays,
    ]
  );

  const [machines, setMachines] = useState([]);
  const [togglingMachineId, setTogglingMachineId] = useState(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(true);
  const [maintenanceOpen, setMaintenanceOpen] = useState(true);
  const [bookingsOpen, setBookingsOpen] = useState(true);

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }

  // Stare Mentenanță
  const [maintenances, setMaintenances] = useState([]);
  const [maintStartDate, setMaintStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [maintEndDate, setMaintEndDate] = useState('');
  const [maintMachineId, setMaintMachineId] = useState('');
  const [maintSelectedTimes, setMaintSelectedTimes] = useState([]);
  const [addingMaint, setAddingMaint] = useState(false);
  const [deletingMaintId, setDeletingMaintId] = useState(null);

  // Stare Programări
  const [allBookings, setAllBookings] = useState([]);
  const [bookingSearch, setBookingSearch] = useState('');
  const [onlyActiveBookings, setOnlyActiveBookings] = useState(false);
  const [onlyConsecutive, setOnlyConsecutive] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const [cancelReasons, setCancelReasons] = useState({});
  const [reasonErrorId, setReasonErrorId] = useState(null);
  const [busyBookingId, setBusyBookingId] = useState(null);

  useEffect(() => {
    const unsub = machinesApi.subscribe(
      (list) => {
        const sorted = [...list].sort((a, b) => {
          if (a.type !== b.type) return a.type === 'washer' ? -1 : 1;
          return a.name.localeCompare(b.name, 'ro');
        });
        setMachines(sorted);
      },
      (err) => logError('admin:machines', err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const unsubMaint = maintenanceApi.subscribeAll(
      (list) => {
        const sorted = [...list].sort((a, b) => {
          if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
          return b.startMinutes - a.startMinutes;
        });
        setMaintenances(sorted);
      },
      (err) => logError('admin:maintenance', err)
    );

    const unsubBookings = bookingsApi.subscribeAll(
      (list) => setAllBookings(list),
      (err) => logError('admin:bookings', err)
    );

    return () => {
      unsubMaint();
      unsubBookings();
    };
  }, [isAdmin]);

  // Mesajul "Salvat" dispare singur
  useEffect(() => {
    if (status?.type !== 'ok') return;
    const t = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const machinesMap = useMemo(() => {
    const map = {};
    machines.forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [machines]);

  // Butoanele de timp pentru mentenanță (de la openMinutes la closeMinutes inclusiv, din 30 în 30 min)
  const maintTimeOptions = useMemo(() => {
    const start = openMinutes ?? DEFAULT_SETTINGS.openMinutes;
    const end = closeMinutes ?? DEFAULT_SETTINGS.closeMinutes;
    const opts = [];
    for (let m = start; m <= end; m += SLOT_MINUTES) {
      opts.push(m);
    }
    return opts;
  }, [openMinutes, closeMinutes]);

  // ID-urile programărilor care fac parte din intervale consecutive (aceeași mașină & zi, lipite)
  const consecutiveIds = useMemo(() => {
    const ids = new Set();
    const activeList = allBookings.filter((b) => b.status !== 'cancelled');
    for (let i = 0; i < activeList.length; i += 1) {
      for (let j = i + 1; j < activeList.length; j += 1) {
        const a = activeList[i];
        const b = activeList[j];
        if (
          a.machineId === b.machineId &&
          isSameDay(a.start, b.start) &&
          (a.end.getTime() === b.start.getTime() || b.end.getTime() === a.start.getTime())
        ) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [allBookings]);

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();

    const filtered = allBookings.filter((b) => {
      if (onlyActiveBookings && b.status === 'cancelled') return false;
      if (onlyConsecutive && !consecutiveIds.has(b.id)) return false;

      if (!q) return true;
      const machineName = (machinesMap[b.machineId]?.name ?? b.machineId).toLowerCase();
      const dateStr = format(b.start, 'dd/MM/yyyy').toLowerCase();
      const userName = (b.userName || b.userId || '').toLowerCase();
      const room = (b.room || '').toLowerCase();
      const reason = (b.cancelReason || '').toLowerCase();

      return (
        userName.includes(q) ||
        room.includes(q) ||
        machineName.includes(q) ||
        dateStr.includes(q) ||
        reason.includes(q)
      );
    });

    return filtered.sort((a, b) =>
      sortDesc ? b.start.getTime() - a.start.getTime() : a.start.getTime() - b.start.getTime()
    );
  }, [allBookings, bookingSearch, onlyActiveBookings, onlyConsecutive, consecutiveIds, machinesMap, sortDesc]);

  // Protecție în interfață. Serverul trebuie să verifice rolul ADMIN pe PUT /settings.
  if (!isAdmin) {
    return (
      <div className="admin-panel__forbidden">
        <p className="admin-panel__forbidden-title">Acces interzis</p>
        <p className="admin-panel__forbidden-text">Această pagină este doar pentru administratori.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="admin-panel__loading">se incarca.</div>;
  }

  const activeDraft = draft ?? saved;

  const totalSlots = (activeDraft.closeMinutes - activeDraft.openMinutes) / SLOT_MINUTES;
  const dirty =
    activeDraft.openMinutes !== saved.openMinutes ||
    activeDraft.closeMinutes !== saved.closeMinutes ||
    activeDraft.maxSlots !== saved.maxSlots ||
    activeDraft.maxWasherSlotsPerDay !== saved.maxWasherSlotsPerDay ||
    activeDraft.maxDryerSlotsPerDay !== saved.maxDryerSlotsPerDay ||
    activeDraft.blockPastSlots !== saved.blockPastSlots ||
    activeDraft.maxAdvanceDays !== saved.maxAdvanceDays;
  const error = validateSettings(activeDraft);

  // Modificăm formularul; limita se ajustează automat dacă programul devine prea scurt
  const patch = (changes) => {
    setStatus(null);
    setDraft((d) => {
      const base = d ?? saved;
      const next = { ...base, ...changes };
      const total = (next.closeMinutes - next.openMinutes) / SLOT_MINUTES;
      next.maxSlots = Math.max(1, Math.min(next.maxSlots, total));
      next.maxWasherSlotsPerDay = Math.max(1, Math.min(next.maxWasherSlotsPerDay, total));
      next.maxDryerSlotsPerDay = Math.max(1, Math.min(next.maxDryerSlotsPerDay, total));
      return next;
    });
  };

  const handleToggleMachine = async (machine) => {
    if (togglingMachineId) return;
    const nextEnabled = machine.enabled === false;
    setTogglingMachineId(machine.id);
    setStatus(null);
    try {
      await machinesApi.setEnabled(machine.id, nextEnabled);
      setStatus({
        type: 'ok',
        text: `${machine.name} a fost ${nextEnabled ? 'activată' : 'dezactivată'}.`,
      });
    } catch (err) {
      logError('admin:machine-toggle', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setTogglingMachineId(null);
    }
  };

  const handleToggleBlockPast = async () => {
    const nextVal = !activeDraft.blockPastSlots;
    const nextDraft = { ...activeDraft, blockPastSlots: nextVal };
    setDraft(nextDraft);
    setStatus(null);
    try {
      await settingsApi.update(nextDraft);
      setStatus({
        type: 'ok',
        text: `Blocarea orelor trecute a fost ${nextVal ? 'activată' : 'dezactivată'}.`,
      });
    } catch (err) {
      logError('settings:blockPast', err);
      setStatus({ type: 'error', text: userMessage(err) });
    }
  };

  const handleSave = async () => {
    if (error || !dirty || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      await settingsApi.update(activeDraft);
      setStatus({ type: 'ok', text: 'Setările au fost salvate.' });
    } catch (err) {
      logError('settings:update', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  /* ------------ Acțiuni Mentenanță ------------ */
  const toggleMaintTime = (minutes) => {
    setMaintSelectedTimes((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes]
    );
  };

  const allMaintSelected =
    maintTimeOptions.length > 0 &&
    maintTimeOptions.every((m) => maintSelectedTimes.includes(m));

  const handleSelectAllMaintSlots = () => {
    if (allMaintSelected) {
      setMaintSelectedTimes([]);
    } else {
      setMaintSelectedTimes([...maintTimeOptions]);
    }
  };

  const handleAddMaintenance = async () => {
    if (addingMaint) return;
    setStatus(null);

    if (!maintStartDate) {
      setStatus({ type: 'error', text: 'Selectează data de început pentru mentenanță.' });
      return;
    }
    if (maintEndDate && maintEndDate < maintStartDate) {
      setStatus({ type: 'error', text: 'Data de sfârșit nu poate fi înaintea datei de început.' });
      return;
    }
    if (!maintMachineId) {
      setStatus({ type: 'error', text: 'Selectează mașina pentru mentenanță.' });
      return;
    }
    const ranges = buildMaintenanceRanges(maintSelectedTimes, closeMinutes);
    if (ranges.length === 0) {
      setStatus({ type: 'error', text: 'Selectează cel puțin un interval orar.' });
      return;
    }

    setAddingMaint(true);
    try {
      await maintenanceApi.create({
        machineId: maintMachineId,
        startDate: maintStartDate,
        endDate: maintEndDate || maintStartDate,
        ranges,
      });
      setMaintSelectedTimes([]);
      setStatus({
        type: 'ok',
        text: 'Intervalul de mentenanță a fost adăugat. Programările deja existente rămân active.',
      });
    } catch (err) {
      logError('admin:maintenance-create', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setAddingMaint(false);
    }
  };

  const handleDeleteMaintenance = async (id) => {
    if (deletingMaintId) return;
    setDeletingMaintId(id);
    setStatus(null);
    try {
      await maintenanceApi.remove(id);
      setStatus({ type: 'ok', text: 'Intervalul de mentenanță a fost șters.' });
    } catch (err) {
      logError('admin:maintenance-delete', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setDeletingMaintId(null);
    }
  };

  /* ------------ Acțiuni Programări ------------ */
  const selectableBookings = filteredBookings.filter((b) => b.status !== 'cancelled');
  const allSelectableSelected =
    selectableBookings.length > 0 &&
    selectableBookings.every((b) => selectedBookingIds.includes(b.id));

  const handleToggleSelectAllBookings = () => {
    if (allSelectableSelected) {
      setSelectedBookingIds([]);
    } else {
      setSelectedBookingIds(selectableBookings.map((b) => b.id));
    }
  };

  const toggleSelectBooking = (id) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCancelBooking = async (booking) => {
    if (busyBookingId || booking.status === 'cancelled') return;
    const reason = (cancelReasons[booking.id] ?? '').trim();

    if (!reason) {
      setReasonErrorId(booking.id);
      setStatus({
        type: 'error',
        text: 'Introdu un motiv în câmpul „Motiv anulare...” înainte de a anula programarea.',
      });
      return;
    }

    setBusyBookingId(booking.id);
    setReasonErrorId(null);
    setStatus(null);
    try {
      await bookingsApi.adminCancel(booking.id, reason);
      setSelectedBookingIds((prev) => prev.filter((id) => id !== booking.id));
      setStatus({ type: 'ok', text: 'Programarea a fost anulată.' });
    } catch (err) {
      logError('admin:booking-cancel', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleDeleteBooking = async (booking) => {
    if (busyBookingId) return;
    setBusyBookingId(booking.id);
    setStatus(null);
    try {
      await bookingsApi.remove(booking.id);
      setSelectedBookingIds((prev) => prev.filter((id) => id !== booking.id));
      setStatus({ type: 'ok', text: 'Programarea a fost ștearsă integral.' });
    } catch (err) {
      logError('admin:booking-delete', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setBusyBookingId(null);
    }
  };

  const maxDateLabel = format(
    addDays(new Date(), Number.isInteger(activeDraft.maxAdvanceDays) && activeDraft.maxAdvanceDays >= 1 ? activeDraft.maxAdvanceDays : 1),
    'dd/MM/yyyy'
  );

  return (
    <div className="admin-panel">
      <div className="admin-panel__header">
        <h2 className="admin-panel__title">
          <FiTool size={24} aria-hidden="true" className="admin-panel__title-icon" />
          Panou Admin
        </h2>
        <p className="admin-panel__subtitle">
          Gestionează utilizatorii, programările și setările sistemului
        </p>
      </div>

      {/* Setări Disponibilitate */}
      <section className="admin-panel__accordion">
        <button
          type="button"
          onClick={() => setAvailabilityOpen((o) => !o)}
          aria-expanded={availabilityOpen}
          className={`admin-panel__accordion-header ${
            !availabilityOpen ? 'admin-panel__accordion-header--collapsed' : ''
          }`}
        >
          <span className="admin-panel__accordion-title">
            <FiSliders size={18} aria-hidden="true" className="admin-panel__accordion-icon" />
            Setări Disponibilitate
          </span>
          {availabilityOpen ? (
            <FiChevronUp size={18} aria-hidden="true" className="admin-panel__accordion-chevron" />
          ) : (
            <FiChevronDown size={18} aria-hidden="true" className="admin-panel__accordion-chevron" />
          )}
        </button>

        {availabilityOpen && (
          <div className="admin-panel__accordion-body">
            {machines.map((machine) => {
              const isEnabled = machine.enabled !== false;
              return (
                <div key={machine.id} className="admin-panel__option-row">
                  <div className="admin-panel__option-info">
                    <MachineIcon
                      type={machine.type}
                      size={20}
                      className="admin-panel__option-icon"
                    />
                    <div className="admin-panel__option-text">
                      <span className="admin-panel__option-name">{machine.name}</span>
                      <span
                        className={`admin-panel__option-state ${
                          isEnabled ? 'admin-panel__option-state--on' : 'admin-panel__option-state--off'
                        }`}
                      >
                        {isEnabled ? 'Activat' : 'Dezactivat'}
                      </span>
                    </div>
                  </div>

                  <ToggleSwitch
                    checked={isEnabled}
                    disabled={togglingMachineId === machine.id}
                    label={`${isEnabled ? 'Dezactivează' : 'Activează'} ${machine.name}`}
                    onChange={() => handleToggleMachine(machine)}
                  />
                </div>
              );
            })}

            {/* Blocare ore trecute */}
            <div className="admin-panel__option-row">
              <div className="admin-panel__option-info">
                <FiClock size={20} aria-hidden="true" className="admin-panel__option-icon" />
                <div className="admin-panel__option-text">
                  <span className="admin-panel__option-name">Blocare ore trecute</span>
                  <span
                    className={`admin-panel__option-state ${
                      activeDraft.blockPastSlots ? 'admin-panel__option-state--on' : 'admin-panel__option-state--off'
                    }`}
                  >
                    {activeDraft.blockPastSlots ? 'Activată' : 'Dezactivată'}
                  </span>
                </div>
              </div>

              <ToggleSwitch
                checked={activeDraft.blockPastSlots}
                disabled={saving}
                label="Comută blocarea orelor trecute"
                onChange={handleToggleBlockPast}
              />
            </div>

            {/* Zile maxime de programare în avans */}
            <div className="admin-panel__option-row">
              <div className="admin-panel__option-info">
                <FiCalendar size={20} aria-hidden="true" className="admin-panel__option-icon" />
                <div className="admin-panel__option-text">
                  <span className="admin-panel__option-name">Zile maxime de programare în avans</span>
                  <span className="admin-panel__option-state">
                    până pe {maxDateLabel}
                  </span>
                </div>
              </div>

              <div className="admin-panel__advance-controls">
                <input
                  type="number"
                  min={1}
                  max={90}
                  aria-label="Zile maxime de programare în avans"
                  value={activeDraft.maxAdvanceDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    patch({ maxAdvanceDays: Number.isNaN(val) ? 1 : Math.max(1, Math.min(90, val)) });
                  }}
                  className="admin-panel__days-input"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || !!error || saving}
                  className="admin-panel__inline-save"
                >
                  Salvează
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Mentenanță */}
      <section className="admin-panel__accordion">
        <button
          type="button"
          onClick={() => setMaintenanceOpen((o) => !o)}
          aria-expanded={maintenanceOpen}
          className={`admin-panel__accordion-header ${
            !maintenanceOpen ? 'admin-panel__accordion-header--collapsed' : ''
          }`}
        >
          <span className="admin-panel__accordion-title">
            <FiTool size={18} aria-hidden="true" className="admin-panel__accordion-icon" />
            Mentenanță
          </span>
          {maintenanceOpen ? (
            <FiChevronUp size={18} aria-hidden="true" className="admin-panel__accordion-chevron" />
          ) : (
            <FiChevronDown size={18} aria-hidden="true" className="admin-panel__accordion-chevron" />
          )}
        </button>

        {maintenanceOpen && (
          <div className="admin-panel__accordion-body admin-panel__maint-body">
            <h3 className="admin-panel__maint-heading">Adaugă interval mentenanță</h3>

            <div className="admin-panel__maint-form-row">
              <div className="admin-panel__field">
                <label htmlFor="maint-start-date" className="admin-panel__label">
                  DATA START
                </label>
                <input
                  id="maint-start-date"
                  type="date"
                  value={maintStartDate}
                  onChange={(e) => {
                    setMaintStartDate(e.target.value);
                    if (maintEndDate && e.target.value && maintEndDate < e.target.value) {
                      setMaintEndDate(e.target.value);
                    }
                  }}
                  className="admin-panel__input"
                />
              </div>

              <div className="admin-panel__field">
                <label htmlFor="maint-end-date" className="admin-panel__label">
                  DATA SFÂRȘIT (OPȚIONAL)
                </label>
                <input
                  id="maint-end-date"
                  type="date"
                  min={maintStartDate || undefined}
                  value={maintEndDate}
                  onChange={(e) => setMaintEndDate(e.target.value)}
                  className="admin-panel__input"
                />
              </div>

              <div className="admin-panel__field">
                <label htmlFor="maint-machine" className="admin-panel__label">
                  MAȘINA
                </label>
                <select
                  id="maint-machine"
                  value={maintMachineId}
                  onChange={(e) => setMaintMachineId(e.target.value)}
                  className="admin-panel__select admin-panel__select--maint"
                >
                  <option value="">Selectează mașina</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <FiChevronDown size={16} aria-hidden="true" className="admin-panel__chevron admin-panel__chevron--maint" />
              </div>
            </div>

            <div className="admin-panel__maint-slots-header">
              <span className="admin-panel__maint-slots-label">Alege intervalul:</span>
              <button
                type="button"
                onClick={handleSelectAllMaintSlots}
                className="admin-panel__maint-select-all"
              >
                {allMaintSelected ? 'Deselectează tot' : 'Selectează toată ziua'}
              </button>
            </div>

            <div className="admin-panel__maint-slots-grid">
              {maintTimeOptions.map((m) => {
                const selected = maintSelectedTimes.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleMaintTime(m)}
                    className={`admin-panel__maint-slot ${
                      selected ? 'admin-panel__maint-slot--selected' : ''
                    }`}
                  >
                    {formatClock(m)}
                  </button>
                );
              })}
            </div>

            <div className="admin-panel__maint-submit-row">
              <button
                type="button"
                onClick={handleAddMaintenance}
                disabled={addingMaint || !maintMachineId || !maintStartDate || maintSelectedTimes.length === 0}
                className="admin-panel__maint-add-btn"
              >
                {addingMaint ? 'Se adaugă...' : 'Adaugă Mentenanță'}
              </button>
            </div>

            <h3 className="admin-panel__maint-heading admin-panel__maint-heading--table">
              Intervale de mentenanță
            </h3>

            <div className="admin-panel__table-wrap">
              <table className="admin-panel__table">
                <thead>
                  <tr>
                    <th>DATA</th>
                    <th>MAȘINA</th>
                    <th>INTERVAL</th>
                    <th className="admin-panel__th-actions">ACȚIUNI</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenances.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="admin-panel__table-empty">
                        Nu există intervale de mentenanță configurate.
                      </td>
                    </tr>
                  ) : (
                    maintenances.map((item) => (
                      <tr key={item.id}>
                        <td>{formatMaintDateRange(item.startDate, item.endDate)}</td>
                        <td>{machinesMap[item.machineId]?.name ?? item.machineId}</td>
                        <td>
                          {formatClock(item.startMinutes)} - {formatClock(item.endMinutes)}
                        </td>
                        <td className="admin-panel__td-actions">
                          <button
                            type="button"
                            disabled={deletingMaintId === item.id}
                            onClick={() => handleDeleteMaintenance(item.id)}
                            className="admin-panel__btn-danger"
                          >
                            Șterge
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Programări */}
      <section className="admin-panel__accordion">
        <button
          type="button"
          onClick={() => setBookingsOpen((o) => !o)}
          aria-expanded={bookingsOpen}
          className={`admin-panel__accordion-header ${
            !bookingsOpen ? 'admin-panel__accordion-header--collapsed' : ''
          }`}
        >
          <span className="admin-panel__accordion-title">
            <FiCalendar size={18} aria-hidden="true" className="admin-panel__accordion-icon" />
            Programări ({filteredBookings.length})
          </span>
          {bookingsOpen ? (
            <FiChevronUp size={18} aria-hidden="true" className="admin-panel__accordion-chevron" />
          ) : (
            <FiChevronDown size={18} aria-hidden="true" className="admin-panel__accordion-chevron" />
          )}
        </button>

        {bookingsOpen && (
          <div className="admin-panel__accordion-body admin-panel__bookings-body">
            <div className="admin-panel__bookings-toolbar">
              <input
                type="text"
                placeholder="Caută (nume, cameră, mașină, dată...)"
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="admin-panel__search-input"
              />

              <div className="admin-panel__bookings-filters">
                <label className="admin-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyActiveBookings}
                    onChange={(e) => setOnlyActiveBookings(e.target.checked)}
                  />
                  <span>Arată doar rezervările active</span>
                </label>

                <label className="admin-panel__checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyConsecutive}
                    onChange={(e) => setOnlyConsecutive(e.target.checked)}
                  />
                  <span>Intervale consecutive</span>
                </label>
              </div>
            </div>

            <div className="admin-panel__table-wrap">
              <table className="admin-panel__table admin-panel__table--bookings">
                <thead>
                  <tr>
                    <th className="admin-panel__th-check">
                      <input
                        type="checkbox"
                        checked={allSelectableSelected}
                        onChange={handleToggleSelectAllBookings}
                        aria-label="Selectează toate programările active"
                      />
                    </th>
                    <th
                      className="admin-panel__th-sortable"
                      onClick={() => setSortDesc((d) => !d)}
                    >
                      DATA {sortDesc ? '↓' : '↑'}
                    </th>
                    <th>MAȘINĂ</th>
                    <th>ORĂ ÎNCEPUT</th>
                    <th>ORĂ SFÂRȘIT</th>
                    <th>DURATA</th>
                    <th>NUME</th>
                    <th>CAMERĂ</th>
                    <th>MOTIV ANULARE</th>
                    <th className="admin-panel__th-actions">ACȚIUNI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="admin-panel__table-empty">
                        Nu există programări care să corespundă criteriilor.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => {
                      const isCancelled = b.status === 'cancelled';
                      const durationMin = Math.max(0, differenceInMinutes(b.end, b.start));
                      const machineName = machinesMap[b.machineId]?.name ?? b.machineId;
                      const reasonValue = isCancelled
                        ? b.cancelReason || ''
                        : cancelReasons[b.id] ?? '';
                      const isBusy = busyBookingId === b.id;

                      return (
                        <tr
                          key={b.id}
                          className={`admin-panel__booking-row ${
                            isCancelled ? 'admin-panel__booking-row--cancelled' : ''
                          }`}
                        >
                          <td className="admin-panel__td-check">
                            <input
                              type="checkbox"
                              disabled={isCancelled}
                              checked={!isCancelled && selectedBookingIds.includes(b.id)}
                              onChange={() => toggleSelectBooking(b.id)}
                              aria-label={`Selectează programarea din ${format(b.start, 'dd/MM/yyyy')}`}
                            />
                          </td>
                          <td className="admin-panel__td-nowrap">{format(b.start, 'dd/MM/yyyy')}</td>
                          <td className="admin-panel__td-nowrap">{machineName}</td>
                          <td className="admin-panel__td-nowrap">{format(b.start, 'HH:mm')}</td>
                          <td className="admin-panel__td-nowrap">{format(b.end, 'HH:mm')}</td>
                          <td className="admin-panel__td-nowrap">{durationMin} min</td>
                          <td className="admin-panel__td-name">{b.userName || b.userId || '—'}</td>
                          <td className="admin-panel__td-nowrap">{b.room || '—'}</td>
                          <td className="admin-panel__td-reason">
                            <input
                              type="text"
                              placeholder="Motiv anulare..."
                              value={reasonValue}
                              disabled={isCancelled || isBusy}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCancelReasons((prev) => ({ ...prev, [b.id]: val }));
                                if (reasonErrorId === b.id) setReasonErrorId(null);
                              }}
                              className={`admin-panel__reason-input ${
                                reasonErrorId === b.id ? 'admin-panel__reason-input--error' : ''
                              }`}
                            />
                          </td>
                          <td className="admin-panel__td-actions">
                            <div className="admin-panel__booking-actions">
                              <button
                                type="button"
                                disabled={isCancelled || isBusy}
                                onClick={() => handleCancelBooking(b)}
                                className={`admin-panel__btn-cancel ${
                                  isCancelled ? 'admin-panel__btn-cancel--done' : ''
                                }`}
                              >
                                {isCancelled ? 'Anulat' : 'Anulează'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeleteBooking(b)}
                                className="admin-panel__btn-danger admin-panel__btn-danger--sm"
                              >
                                Șterge
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Program */}
      <Card>
        <h3 className="admin-panel__card-title">Program de rezervare</h3>
        <p className="admin-panel__card-desc">
          Intervalul orar în care se pot face rezervări, din 30 în 30 de minute.
        </p>

        <div className="admin-panel__grid">
          <div className="admin-panel__field">
            <label htmlFor="admin-open" className="admin-panel__label">
              Deschidere
            </label>
            <select
              id="admin-open"
              className="admin-panel__select"
              value={activeDraft.openMinutes}
              onChange={(e) => patch({ openMinutes: Number(e.target.value) })}
            >
              {OPEN_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m >= activeDraft.closeMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <FiChevronDown size={18} aria-hidden="true" className="admin-panel__chevron" />
          </div>

          <div className="admin-panel__field">
            <label htmlFor="admin-close" className="admin-panel__label">
              Închidere
            </label>
            <select
              id="admin-close"
              className="admin-panel__select"
              value={activeDraft.closeMinutes}
              onChange={(e) => patch({ closeMinutes: Number(e.target.value) })}
            >
              {CLOSE_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m <= activeDraft.openMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <FiChevronDown size={18} aria-hidden="true" className="admin-panel__chevron" />
          </div>
        </div>

        <p className="admin-panel__summary">
          {formatClock(activeDraft.openMinutes)} - {formatClock(activeDraft.closeMinutes)} ·{' '}
          <span className="admin-panel__summary-strong">{totalSlots} intervale pe zi</span>
        </p>
      </Card>

      {/* Număr maxim de intervale pe zi (Mașini de spălat & Uscătoare) */}
      <Card>
        <h3 className="admin-panel__card-title">Număr maxim de intervale pe zi</h3>
        <p className="admin-panel__card-desc">
          Câte intervale de {SLOT_MINUTES} de minute poate rezerva un utilizator într-o zi, separat pentru mașinile de spălat și pentru uscătoare.
        </p>

        <div className="admin-panel__daily-limits">
          {/* Mașini de spălat */}
          <div className="admin-panel__daily-limit-box">
            <div className="admin-panel__daily-limit-head">
              <MachineIcon type="washer" size={20} className="admin-panel__option-icon" />
              <span>Mașini de spălat</span>
            </div>

            <div className="admin-panel__stepper">
              <button
                type="button"
                className="admin-panel__step-btn"
                aria-label="Scade limita zilnică pentru mașini de spălat"
                disabled={activeDraft.maxWasherSlotsPerDay <= 1}
                onClick={() => patch({ maxWasherSlotsPerDay: activeDraft.maxWasherSlotsPerDay - 1 })}
              >
                <FiMinus size={20} aria-hidden="true" />
              </button>

              <div className="admin-panel__stepper-display" aria-live="polite">
                <p className="admin-panel__stepper-value">
                  {formatDuration(activeDraft.maxWasherSlotsPerDay * SLOT_MINUTES)}
                </p>
                <p className="admin-panel__stepper-sub">
                  {activeDraft.maxWasherSlotsPerDay}{' '}
                  {activeDraft.maxWasherSlotsPerDay === 1 ? 'interval' : 'intervale'} / zi
                </p>
              </div>

              <button
                type="button"
                className="admin-panel__step-btn"
                aria-label="Crește limita zilnică pentru mașini de spălat"
                disabled={activeDraft.maxWasherSlotsPerDay >= totalSlots}
                onClick={() => patch({ maxWasherSlotsPerDay: activeDraft.maxWasherSlotsPerDay + 1 })}
              >
                <FiPlus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Uscătoare */}
          <div className="admin-panel__daily-limit-box">
            <div className="admin-panel__daily-limit-head">
              <MachineIcon type="dryer" size={20} className="admin-panel__option-icon" />
              <span>Uscătoare</span>
            </div>

            <div className="admin-panel__stepper">
              <button
                type="button"
                className="admin-panel__step-btn"
                aria-label="Scade limita zilnică pentru uscătoare"
                disabled={activeDraft.maxDryerSlotsPerDay <= 1}
                onClick={() => patch({ maxDryerSlotsPerDay: activeDraft.maxDryerSlotsPerDay - 1 })}
              >
                <FiMinus size={20} aria-hidden="true" />
              </button>

              <div className="admin-panel__stepper-display" aria-live="polite">
                <p className="admin-panel__stepper-value">
                  {formatDuration(activeDraft.maxDryerSlotsPerDay * SLOT_MINUTES)}
                </p>
                <p className="admin-panel__stepper-sub">
                  {activeDraft.maxDryerSlotsPerDay}{' '}
                  {activeDraft.maxDryerSlotsPerDay === 1 ? 'interval' : 'intervale'} / zi
                </p>
              </div>

              <button
                type="button"
                className="admin-panel__step-btn"
                aria-label="Crește limita zilnică pentru uscătoare"
                disabled={activeDraft.maxDryerSlotsPerDay >= totalSlots}
                onClick={() => patch({ maxDryerSlotsPerDay: activeDraft.maxDryerSlotsPerDay + 1 })}
              >
                <FiPlus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      <p className="admin-panel__note">
        Rezervările deja făcute nu sunt șterse. Cele din afara noului program rămân salvate, dar nu mai apar în calendar.
      </p>

      {error && <p className="admin-panel__error">{error}</p>}

      {status && (
        <p
          role="status"
          className={`admin-panel__status admin-panel__status--${status.type}`}
        >
          {status.type === 'ok' ? '✓ ' : ''}{status.text}
        </p>
      )}

      <div className="admin-panel__actions">
        <button
          type="button"
          disabled={saving}
          onClick={() => { setStatus(null); setDraft({ ...DEFAULT_SETTINGS }); }}
          className="admin-panel__btn-reset"
        >
          Valori implicite
        </button>
        <button
          type="button"
          disabled={!dirty || !!error || saving}
          onClick={handleSave}
          className="admin-panel__btn-save"
        >
          {saving ? 'Se salvează...' : 'Salvează modificările'}
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;
