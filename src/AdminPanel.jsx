import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './auth/AuthContext';
import { settingsApi } from './data';
import { userMessage } from './data/errors';
import { logError } from './utils/logger';
import { useSettings } from './useSettings';
import {
  validateSettings, SLOT_MINUTES, DEFAULT_SETTINGS, formatClock, formatDuration,
} from './settingsModel';

// Opțiunile din liste: din 30 în 30 de minute
const OPEN_OPTIONS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES);
const CLOSE_OPTIONS = OPEN_OPTIONS.map((m) => m + SLOT_MINUTES);

const FIELD_CLASS =
  'w-full rounded-xl pl-4 pr-10 py-3 font-bold bg-[color:var(--card-inner-bg)] text-[color:var(--card-title)] ' +
  'border border-[color:var(--field-border)] focus:outline-none focus:ring-2 focus:ring-[color:var(--btn-bg)] ' +
  'appearance-none cursor-pointer';

// Săgeata din dreapta câmpurilor de selectare, poziționată cu margine față de colț
const SelectChevron = () => (
  <svg
    viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    className="pointer-events-none absolute right-4 bottom-[16px] text-[color:var(--card-title)]"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const STEP_BTN_CLASS =
  'w-12 h-12 shrink-0 rounded-xl text-2xl font-bold leading-none bg-[color:var(--card-icon-bg)] ' +
  'text-[color:var(--card-title)] transition active:scale-95 disabled:opacity-40 disabled:active:scale-100';

const Card = ({ children }) => (
  <section className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-5 shadow-lg">
    {children}
  </section>
);

const AdminPanel = () => {
  const { isAdmin } = useAuth();
  const { openMinutes, closeMinutes, maxSlots, loading } = useSettings();
  const saved = useMemo(
    () => ({ openMinutes, closeMinutes, maxSlots }),
    [openMinutes, closeMinutes, maxSlots]
  );

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }

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
      <div className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-6 text-center shadow-lg">
        <p className="font-bold text-[color:var(--card-title)]">Acces interzis</p>
        <p className="text-sm text-[color:var(--card-muted)] mt-1">Această pagină este doar pentru administratori.</p>
      </div>
    );
  }

  if (loading || !draft) {
    return <div className="text-center text-[color:var(--on-bg)] mt-10 font-bold">se incarca.</div>;
  }

  const totalSlots = (draft.closeMinutes - draft.openMinutes) / SLOT_MINUTES;
  const dirty =
    draft.openMinutes !== saved.openMinutes ||
    draft.closeMinutes !== saved.closeMinutes ||
    draft.maxSlots !== saved.maxSlots;
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

  return (
    <div className="w-full flex flex-col gap-4 lg:max-w-2xl lg:mx-auto">
      <div className="px-2">
        <h2 className="text-xl font-bold text-[color:var(--on-bg)] drop-shadow-sm">Panou administrator</h2>
        <p className="text-sm text-[color:var(--on-bg-muted)]">
          Modificările se aplică imediat tuturor utilizatorilor.
        </p>
      </div>

      {/* Program */}
      <Card>
        <h3 className="font-bold text-[color:var(--card-title)] mb-1">Program de rezervare</h3>
        <p className="text-sm text-[color:var(--card-muted)] mb-4">
          Intervalul orar în care se pot face rezervări, din 30 în 30 de minute.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label htmlFor="admin-open" className="block text-xs font-bold text-[color:var(--card-muted)] mb-1.5">
              Deschidere
            </label>
            <select
              id="admin-open"
              className={FIELD_CLASS}
              value={draft.openMinutes}
              onChange={(e) => patch({ openMinutes: Number(e.target.value) })}
            >
              {OPEN_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m >= draft.closeMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>

          <div className="relative">
            <label htmlFor="admin-close" className="block text-xs font-bold text-[color:var(--card-muted)] mb-1.5">
              Închidere
            </label>
            <select
              id="admin-close"
              className={FIELD_CLASS}
              value={draft.closeMinutes}
              onChange={(e) => patch({ closeMinutes: Number(e.target.value) })}
            >
              {CLOSE_OPTIONS.map((m) => (
                <option key={m} value={m} disabled={m <= draft.openMinutes}>
                  {formatClock(m)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <p className="mt-4 text-sm text-[color:var(--card-muted)]">
          {formatClock(draft.openMinutes)} - {formatClock(draft.closeMinutes)} ·{' '}
          <span className="font-bold text-[color:var(--card-title)]">{totalSlots} intervale pe zi</span>
        </p>
      </Card>

      {/* Limită per rezervare */}
      <Card>
        <h3 className="font-bold text-[color:var(--card-title)] mb-1">Durata maximă a unei rezervări</h3>
        <p className="text-sm text-[color:var(--card-muted)] mb-4">
          Câte intervale de {SLOT_MINUTES} de minute poate selecta un utilizator într-o singură rezervare.
        </p>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            className={STEP_BTN_CLASS}
            aria-label="Scade limita cu un interval"
            disabled={draft.maxSlots <= 1}
            onClick={() => patch({ maxSlots: draft.maxSlots - 1 })}
          >
            −
          </button>

          <div className="text-center" aria-live="polite">
            <p className="text-3xl font-extrabold text-[color:var(--card-title)] leading-tight">
              {formatDuration(draft.maxSlots * SLOT_MINUTES)}
            </p>
            <p className="text-sm text-[color:var(--card-muted)]">
              {draft.maxSlots} {draft.maxSlots === 1 ? 'interval' : 'intervale'} × {SLOT_MINUTES} min
            </p>
          </div>

          <button
            type="button"
            className={STEP_BTN_CLASS}
            aria-label="Crește limita cu un interval"
            disabled={draft.maxSlots >= totalSlots}
            onClick={() => patch({ maxSlots: draft.maxSlots + 1 })}
          >
            +
          </button>
        </div>
      </Card>

      <p className="text-xs text-[color:var(--on-bg-muted)] px-2">
        Rezervările deja făcute nu sunt șterse. Cele din afara noului program rămân salvate, dar nu mai apar în calendar.
      </p>

      {error && <p className="text-sm font-bold text-[color:var(--cal-danger)] px-2">{error}</p>}

      {status && (
        <p
          role="status"
          className={`text-sm font-bold px-2 ${
            status.type === 'ok' ? 'text-[color:var(--on-bg)]' : 'text-[color:var(--cal-danger)]'
          }`}
        >
          {status.type === 'ok' ? '✓ ' : ''}{status.text}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => { setStatus(null); setDraft({ ...DEFAULT_SETTINGS }); }}
          className="flex-1 py-3 rounded-xl font-bold border-2 border-[color:var(--on-bg-muted)] text-[color:var(--on-bg)] transition active:scale-[0.98] disabled:opacity-50"
        >
          Valori implicite
        </button>
        <button
          type="button"
          disabled={!dirty || !!error || saving}
          onClick={handleSave}
          className="flex-[2] py-3 rounded-xl font-bold text-white bg-[color:var(--btn-bg)] hover:bg-[color:var(--btn-hover)] active:bg-[color:var(--btn-active)] shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Se salvează...' : 'Salvează modificările'}
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;