// Model pur al setărilor (fără Firebase / fără rețea).
// Validarea de aici este doar pentru experiența utilizatorului:
// serverul trebuie să repete aceleași verificări -> asta zice claude

export const SLOT_MINUTES = 30;

export const DEFAULT_SETTINGS = {
  openMinutes: 8 * 60,   // 08:00
  closeMinutes: 21 * 60, // 21:00
  maxSlots: 4,           // 4 x 30 min = 2h
  blockPastSlots: true,
  maxAdvanceDays: 7,
};

export const formatClock = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}min`].filter(Boolean).join(' ') || '0min';
};

/** Returnează un mesaj de eroare, sau null dacă setările sunt valide. */
export const validateSettings = (settings) => {
  const { openMinutes, closeMinutes, maxSlots, blockPastSlots, maxAdvanceDays } = settings ?? {};
  const isStep = (n) => Number.isInteger(n) && n % SLOT_MINUTES === 0;

  if (!isStep(openMinutes) || openMinutes < 0 || openMinutes > 24 * 60 - SLOT_MINUTES) {
    return 'Ora de deschidere nu este validă.';
  }
  if (!isStep(closeMinutes) || closeMinutes < SLOT_MINUTES || closeMinutes > 24 * 60) {
    return 'Ora de închidere nu este validă.';
  }
  if (closeMinutes <= openMinutes) {
    return 'Ora de închidere trebuie să fie după ora de deschidere.';
  }

  const totalSlots = (closeMinutes - openMinutes) / SLOT_MINUTES;
  if (!Number.isInteger(maxSlots) || maxSlots < 1) {
    return 'O rezervare trebuie să aibă cel puțin un interval.';
  }
  if (maxSlots > totalSlots) {
    return 'Limita depășește numărul de intervale dintr-o zi.';
  }

  if (blockPastSlots !== undefined && typeof blockPastSlots !== 'boolean') {
    return 'Setarea pentru blocarea orelor trecute nu este validă.';
  }

  if (maxAdvanceDays !== undefined && (!Number.isInteger(maxAdvanceDays) || maxAdvanceDays < 1 || maxAdvanceDays > 90)) {
    return 'Numărul de zile în avans trebuie să fie între 1 și 90.';
  }

  return null;
};
