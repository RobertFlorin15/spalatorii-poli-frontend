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
import { addDays, format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { machinesApi, settingsApi } from '../../api';
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
    blockPastSlots,
    maxAdvanceDays,
    loading,
  } = useSettings();

  const saved = useMemo(
    () => ({
      openMinutes,
      closeMinutes,
      maxSlots,
      blockPastSlots,
      maxAdvanceDays,
    }),
    [openMinutes, closeMinutes, maxSlots, blockPastSlots, maxAdvanceDays]
  );

  const [machines, setMachines] = useState([]);
  const [togglingMachineId, setTogglingMachineId] = useState(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(true);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }

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

  // Inițializăm formularul cu valorile salvate, o singură dată
  useEffect(() => {
    if (!loading && draft === null) setDraft(saved);
  }, [loading, draft, saved]);

  // Mesajul "Salvat" dispare singur
  useEffect(() => {
    if (status?.type !== 'ok') return;
    const t = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(t);
  }, [status]);

  // Protecție în interfață. Serverul trebuie să verifice rolul ADMIN pe PUT /settings.
  if (!isAdmin) {
    return (
      <div className="admin-panel__forbidden">
        <p className="admin-panel__forbidden-title">Acces interzis</p>
        <p className="admin-panel__forbidden-text">Această pagină este doar pentru administratori.</p>
      </div>
    );
  }

  if (loading || !draft) {
    return <div className="admin-panel__loading">se incarca.</div>;
  }

  const totalSlots = (draft.closeMinutes - draft.openMinutes) / SLOT_MINUTES;
  const dirty =
    draft.openMinutes !== saved.openMinutes ||
    draft.closeMinutes !== saved.closeMinutes ||
    draft.maxSlots !== saved.maxSlots ||
    draft.blockPastSlots !== saved.blockPastSlots ||
    draft.maxAdvanceDays !== saved.maxAdvanceDays;
  const error = validateSettings(draft);

  // Modificăm formularul; limita se ajustează automat dacă programul devine prea scurt
  const patch = (changes) => {
    setStatus(null);
    setDraft((d) => {
      const next = { ...d, ...changes };
      const total = (next.closeMinutes - next.openMinutes) / SLOT_MINUTES;
      next.maxSlots = Math.max(1, Math.min(next.maxSlots, total));
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
    const nextVal = !draft.blockPastSlots;
    const nextDraft = { ...draft, blockPastSlots: nextVal };
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
      await settingsApi.update(draft);
      setStatus({ type: 'ok', text: 'Setările au fost salvate.' });
    } catch (err) {
      logError('settings:update', err);
      setStatus({ type: 'error', text: userMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const maxDateLabel = format(
    addDays(new Date(), Number.isInteger(draft.maxAdvanceDays) && draft.maxAdvanceDays >= 1 ? draft.maxAdvanceDays : 1),
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
                      draft.blockPastSlots ? 'admin-panel__option-state--on' : 'admin-panel__option-state--off'
                    }`}
                  >
                    {draft.blockPastSlots ? 'Activată' : 'Dezactivată'}
                  </span>
                </div>
              </div>

              <ToggleSwitch
                checked={draft.blockPastSlots}
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
                  value={draft.maxAdvanceDays}
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
              value={draft.openMinutes}
              onChange={(e) => patch({ openMinutes: Number(e.target.value) })}
            >
              {OPEN_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m >= draft.closeMinutes}>
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
              value={draft.closeMinutes}
              onChange={(e) => patch({ closeMinutes: Number(e.target.value) })}
            >
              {CLOSE_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m <= draft.openMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <FiChevronDown size={18} aria-hidden="true" className="admin-panel__chevron" />
          </div>
        </div>

        <p className="admin-panel__summary">
          {formatClock(draft.openMinutes)} - {formatClock(draft.closeMinutes)} ·{' '}
          <span className="admin-panel__summary-strong">{totalSlots} intervale pe zi</span>
        </p>
      </Card>

      {/* Limită per rezervare */}
      <Card>
        <h3 className="admin-panel__card-title">Durata maximă a unei rezervări</h3>
        <p className="admin-panel__card-desc">
          Câte intervale de {SLOT_MINUTES} de minute poate selecta un utilizator într-o singură rezervare.
        </p>

        <div className="admin-panel__stepper">
          <button
            type="button"
            className="admin-panel__step-btn"
            aria-label="Scade limita cu un interval"
            disabled={draft.maxSlots <= 1}
            onClick={() => patch({ maxSlots: draft.maxSlots - 1 })}
          >
            <FiMinus size={20} aria-hidden="true" />
          </button>

          <div className="admin-panel__stepper-display" aria-live="polite">
            <p className="admin-panel__stepper-value">
              {formatDuration(draft.maxSlots * SLOT_MINUTES)}
            </p>
            <p className="admin-panel__stepper-sub">
              {draft.maxSlots} {draft.maxSlots === 1 ? 'interval' : 'intervale'} × {SLOT_MINUTES} min
            </p>
          </div>

          <button
            type="button"
            className="admin-panel__step-btn"
            aria-label="Crește limita cu un interval"
            disabled={draft.maxSlots >= totalSlots}
            onClick={() => patch({ maxSlots: draft.maxSlots + 1 })}
          >
            <FiPlus size={20} aria-hidden="true" />
          </button>
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
