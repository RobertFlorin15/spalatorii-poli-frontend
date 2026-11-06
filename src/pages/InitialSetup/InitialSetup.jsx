import { useState, useEffect, useMemo } from 'react';
import {
  FiSliders,
  FiChevronDown,
  FiMinus,
  FiPlus,
  FiClock,
  FiCalendar,
  FiInfo,
  FiCheckCircle,
} from 'react-icons/fi';
import { addDays, format } from 'date-fns';
import { machinesApi, settingsApi } from '../../api';
import { userMessage } from '../../api/errors';
import { logError } from '../../utils/logger';
import { useSettings } from '../../hooks/useSettings';
import MachineIcon from '../../components/MachineIcon/MachineIcon';
import {
  SLOT_MINUTES,
  validateSettings,
  formatClock,
  formatDuration,
} from '../../utils/settingsModel';
import './InitialSetup.scss';

const OPEN_OPTIONS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES);
const CLOSE_OPTIONS = OPEN_OPTIONS.map((m) => m + SLOT_MINUTES);

const InitialSetup = ({ onComplete }) => {
  const {
    openMinutes,
    closeMinutes,
    maxSlots,
    maxWasherSlotsPerDay,
    maxDryerSlotsPerDay,
    blockPastSlots,
    maxAdvanceDays,
    loading: settingsLoading,
  } = useSettings();

  const [existingMachines, setExistingMachines] = useState([]);
  const [machinesLoaded, setMachinesLoaded] = useState(false);

  const [washerCount, setWasherCount] = useState(null);
  const [dryerCount, setDryerCount] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const unsub = machinesApi.subscribe(
      (list) => {
        setExistingMachines(list);
        setMachinesLoaded(true);
      },
      (err) => {
        logError('setup:machines', err);
        setMachinesLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  const initialCounts = useMemo(() => {
    const w = existingMachines.filter((m) => m.type === 'washer').length;
    const d = existingMachines.filter((m) => m.type === 'dryer').length;
    return {
      washers: w > 0 ? w : 2,
      dryers: w > 0 || d > 0 ? d : 2,
    };
  }, [existingMachines]);

  if (settingsLoading || !machinesLoaded) {
    return <div className="initial-setup__loading">se incarca.</div>;
  }

  const activeWasherCount = washerCount ?? initialCounts.washers;
  const activeDryerCount = dryerCount ?? initialCounts.dryers;

  const activeDraft = draft ?? {
    openMinutes,
    closeMinutes,
    maxSlots,
    maxWasherSlotsPerDay,
    maxDryerSlotsPerDay,
    blockPastSlots,
    maxAdvanceDays,
  };

  const totalSlots = (activeDraft.closeMinutes - activeDraft.openMinutes) / SLOT_MINUTES;
  const validationError = validateSettings(activeDraft);

  const patch = (changes) => {
    setErrorMsg(null);
    setDraft((prev) => {
      const base = prev ?? activeDraft;
      const next = { ...base, ...changes };
      const total = (next.closeMinutes - next.openMinutes) / SLOT_MINUTES;
      next.maxSlots = Math.max(1, Math.min(next.maxSlots, total));
      next.maxWasherSlotsPerDay = Math.max(1, Math.min(next.maxWasherSlotsPerDay, total));
      next.maxDryerSlotsPerDay = Math.max(1, Math.min(next.maxDryerSlotsPerDay, total));
      return next;
    });
  };

  const maxDateLabel = format(
    addDays(
      new Date(),
      Number.isInteger(activeDraft.maxAdvanceDays) && activeDraft.maxAdvanceDays >= 1
        ? activeDraft.maxAdvanceDays
        : 1
    ),
    'dd/MM/yyyy'
  );

  const handleFinish = async () => {
    if (saving || validationError) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await machinesApi.syncCounts(activeWasherCount, activeDryerCount, existingMachines);
      await settingsApi.update({
        ...activeDraft,
        isConfigured: true,
      });
      if (onComplete) onComplete();
    } catch (err) {
      logError('setup:save', err);
      setErrorMsg(userMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="initial-setup">
      <div className="initial-setup__header">
        <div className="initial-setup__badge">
          <FiSliders size={18} aria-hidden="true" />
          <span>Configurare Inițială</span>
        </div>
        <h2 className="initial-setup__title">Setează spălătoria căminului</h2>
        <p className="initial-setup__subtitle">
          Configurează echipamentele și regulile de programare pentru studenți înainte de prima utilizare.
        </p>
      </div>

      {/* 1. Numărul de mașini și uscătoare */}
      <section className="initial-setup__card">
        <h3 className="initial-setup__card-title">1. Numărul de mașini de spălat și uscătoare</h3>
        <p className="initial-setup__card-desc">
          Selectează câte mașini de spălat și câte uscătoare sunt disponibile în spălătoria căminului.
        </p>

        <div className="initial-setup__dual-grid">
          <div className="initial-setup__box">
            <div className="initial-setup__box-head">
              <MachineIcon type="washer" size={20} className="initial-setup__box-icon" />
              <span>Mașini de spălat</span>
            </div>

            <div className="initial-setup__stepper">
              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Scade numărul de mașini de spălat"
                disabled={activeWasherCount <= 1 || saving}
                onClick={() => setWasherCount(Math.max(1, activeWasherCount - 1))}
              >
                <FiMinus size={20} aria-hidden="true" />
              </button>

              <div className="initial-setup__stepper-display" aria-live="polite">
                <p className="initial-setup__stepper-value">{activeWasherCount}</p>
                <p className="initial-setup__stepper-sub">
                  {activeWasherCount === 1 ? 'mașină de spălat' : 'mașini de spălat'}
                </p>
              </div>

              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Crește numărul de mașini de spălat"
                disabled={activeWasherCount >= 30 || saving}
                onClick={() => setWasherCount(Math.min(30, activeWasherCount + 1))}
              >
                <FiPlus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="initial-setup__box">
            <div className="initial-setup__box-head">
              <MachineIcon type="dryer" size={20} className="initial-setup__box-icon" />
              <span>Uscătoare</span>
            </div>

            <div className="initial-setup__stepper">
              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Scade numărul de uscătoare"
                disabled={activeDryerCount <= 0 || saving}
                onClick={() => setDryerCount(Math.max(0, activeDryerCount - 1))}
              >
                <FiMinus size={20} aria-hidden="true" />
              </button>

              <div className="initial-setup__stepper-display" aria-live="polite">
                <p className="initial-setup__stepper-value">{activeDryerCount}</p>
                <p className="initial-setup__stepper-sub">
                  {activeDryerCount === 1 ? 'uscător' : 'uscătoare'}
                </p>
              </div>

              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Crește numărul de uscătoare"
                disabled={activeDryerCount >= 30 || saving}
                onClick={() => setDryerCount(Math.min(30, activeDryerCount + 1))}
              >
                <FiPlus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Ora limită și programul */}
      <section className="initial-setup__card">
        <h3 className="initial-setup__card-title">
          <FiClock size={18} aria-hidden="true" className="initial-setup__card-title-icon" />
          2. Ora limită și programul de rezervare
        </h3>
        <p className="initial-setup__card-desc">
          Alege ora de deschidere și ora limită (închidere) până la care se pot face programări în fiecare zi.
        </p>

        <div className="initial-setup__dual-grid">
          <div className="initial-setup__field">
            <label htmlFor="setup-open" className="initial-setup__label">
              Ora de deschidere
            </label>
            <select
              id="setup-open"
              disabled={saving}
              className="initial-setup__select"
              value={activeDraft.openMinutes}
              onChange={(e) => patch({ openMinutes: Number(e.target.value) })}
            >
              {OPEN_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m >= activeDraft.closeMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <FiChevronDown size={18} aria-hidden="true" className="initial-setup__chevron" />
          </div>

          <div className="initial-setup__field">
            <label htmlFor="setup-close" className="initial-setup__label">
              Ora limită (Închidere)
            </label>
            <select
              id="setup-close"
              disabled={saving}
              className="initial-setup__select"
              value={activeDraft.closeMinutes}
              onChange={(e) => patch({ closeMinutes: Number(e.target.value) })}
            >
              {CLOSE_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m <= activeDraft.openMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <FiChevronDown size={18} aria-hidden="true" className="initial-setup__chevron" />
          </div>
        </div>

        <p className="initial-setup__summary">
          Program activ: <strong>{formatClock(activeDraft.openMinutes)} - {formatClock(activeDraft.closeMinutes)}</strong> ·{' '}
          <strong>{totalSlots} intervale</strong> de {SLOT_MINUTES} min pe zi
        </p>
      </section>

      {/* 3. Număr maxim de intervale pe zi */}
      <section className="initial-setup__card">
        <h3 className="initial-setup__card-title">3. Numărul maxim de intervale pe zi</h3>
        <p className="initial-setup__card-desc">
          Câte intervale de {SLOT_MINUTES} de minute poate rezerva un utilizator într-o singură zi, separat pentru mașinile de spălat și pentru uscătoare.
        </p>

        <div className="initial-setup__dual-grid">
          <div className="initial-setup__box">
            <div className="initial-setup__box-head">
              <MachineIcon type="washer" size={20} className="initial-setup__box-icon" />
              <span>Mașini de spălat</span>
            </div>

            <div className="initial-setup__stepper">
              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Scade numărul maxim de intervale pe zi la mașini de spălat"
                disabled={activeDraft.maxWasherSlotsPerDay <= 1 || saving}
                onClick={() => patch({ maxWasherSlotsPerDay: activeDraft.maxWasherSlotsPerDay - 1 })}
              >
                <FiMinus size={20} aria-hidden="true" />
              </button>

              <div className="initial-setup__stepper-display" aria-live="polite">
                <p className="initial-setup__stepper-value">
                  {formatDuration(activeDraft.maxWasherSlotsPerDay * SLOT_MINUTES)}
                </p>
                <p className="initial-setup__stepper-sub">
                  {activeDraft.maxWasherSlotsPerDay}{' '}
                  {activeDraft.maxWasherSlotsPerDay === 1 ? 'interval' : 'intervale'} / zi
                </p>
              </div>

              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Crește numărul maxim de intervale pe zi la mașini de spălat"
                disabled={activeDraft.maxWasherSlotsPerDay >= totalSlots || saving}
                onClick={() => patch({ maxWasherSlotsPerDay: activeDraft.maxWasherSlotsPerDay + 1 })}
              >
                <FiPlus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="initial-setup__box">
            <div className="initial-setup__box-head">
              <MachineIcon type="dryer" size={20} className="initial-setup__box-icon" />
              <span>Uscătoare</span>
            </div>

            <div className="initial-setup__stepper">
              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Scade numărul maxim de intervale pe zi la uscătoare"
                disabled={activeDraft.maxDryerSlotsPerDay <= 1 || saving}
                onClick={() => patch({ maxDryerSlotsPerDay: activeDraft.maxDryerSlotsPerDay - 1 })}
              >
                <FiMinus size={20} aria-hidden="true" />
              </button>

              <div className="initial-setup__stepper-display" aria-live="polite">
                <p className="initial-setup__stepper-value">
                  {formatDuration(activeDraft.maxDryerSlotsPerDay * SLOT_MINUTES)}
                </p>
                <p className="initial-setup__stepper-sub">
                  {activeDraft.maxDryerSlotsPerDay}{' '}
                  {activeDraft.maxDryerSlotsPerDay === 1 ? 'interval' : 'intervale'} / zi
                </p>
              </div>

              <button
                type="button"
                className="initial-setup__step-btn"
                aria-label="Crește numărul maxim de intervale pe zi la uscătoare"
                disabled={activeDraft.maxDryerSlotsPerDay >= totalSlots || saving}
                onClick={() => patch({ maxDryerSlotsPerDay: activeDraft.maxDryerSlotsPerDay + 1 })}
              >
                <FiPlus size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Numărul maxim de zile de programare în avans */}
      <section className="initial-setup__card">
        <h3 className="initial-setup__card-title">
          <FiCalendar size={18} aria-hidden="true" className="initial-setup__card-title-icon" />
          4. Numărul maxim de zile de programare în avans
        </h3>
        <p className="initial-setup__card-desc">
          Cu câte zile înainte își pot face studenții o rezervare în calendar (între 1 și 90 de zile).
        </p>

        <div className="initial-setup__stepper initial-setup__stepper--single">
          <button
            type="button"
            className="initial-setup__step-btn"
            aria-label="Scade numărul de zile în avans"
            disabled={activeDraft.maxAdvanceDays <= 1 || saving}
            onClick={() => patch({ maxAdvanceDays: Math.max(1, activeDraft.maxAdvanceDays - 1) })}
          >
            <FiMinus size={20} aria-hidden="true" />
          </button>

          <div className="initial-setup__stepper-display" aria-live="polite">
            <p className="initial-setup__stepper-value">
              {activeDraft.maxAdvanceDays} {activeDraft.maxAdvanceDays === 1 ? 'zi' : 'zile'}
            </p>
            <p className="initial-setup__stepper-sub">
              programări permise până pe {maxDateLabel}
            </p>
          </div>

          <button
            type="button"
            className="initial-setup__step-btn"
            aria-label="Crește numărul de zile în avans"
            disabled={activeDraft.maxAdvanceDays >= 90 || saving}
            onClick={() => patch({ maxAdvanceDays: Math.min(90, activeDraft.maxAdvanceDays + 1) })}
          >
            <FiPlus size={20} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Mențiune că le poate modifica oricând din meniul de admin */}
      <div className="initial-setup__notice">
        <FiInfo size={20} aria-hidden="true" className="initial-setup__notice-icon" />
        <p className="initial-setup__notice-text">
          Toate aceste setări (numărul de mașini și uscătoare, ora limită, numărul maxim de intervale pe zi și zilele de programare în avans) <strong>pot fi modificate oricând ulterior din meniul de Admin</strong>.
        </p>
      </div>

      {(validationError || errorMsg) && (
        <p role="alert" className="initial-setup__error">
          {validationError || errorMsg}
        </p>
      )}

      <button
        type="button"
        disabled={saving || !!validationError}
        onClick={handleFinish}
        className="initial-setup__submit"
      >
        <FiCheckCircle size={20} aria-hidden="true" />
        <span>{saving ? 'Se configurează...' : 'Salvează configurarea și continuă'}</span>
      </button>
    </div>
  );
};

export default InitialSetup;
