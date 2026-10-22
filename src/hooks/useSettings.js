import { useState, useEffect } from 'react';
import { settingsApi } from '../api';
import { DEFAULT_SETTINGS, validateSettings } from '../utils/settingsModel';
import { logError } from '../utils/logger';

/**
 * Citește setările (program + limită per rezervare + disponibilitate).
 * Returnează { openMinutes, closeMinutes, maxSlots, blockPastSlots, maxAdvanceDays, loading }.
 *
 * Orice valoare primită de la server este validată: dacă lipsește sau este invalidă,
 * se folosesc valorile implicite, ca interfața să nu se strice niciodată
 * (de exemplu din cauza unor date corupte).
 */
export function useSettings() {
  const [state, setState] = useState({ ...DEFAULT_SETTINGS, loading: true });

  useEffect(() => {
    const unsubscribe = settingsApi.subscribe(
      (raw) => {
        const fallbackSlots = raw?.maxSlots ?? DEFAULT_SETTINGS.maxSlots;
        const candidate = {
          openMinutes: raw?.openMinutes ?? DEFAULT_SETTINGS.openMinutes,
          closeMinutes: raw?.closeMinutes ?? DEFAULT_SETTINGS.closeMinutes,
          maxSlots: fallbackSlots,
          maxWasherSlotsPerDay: Number.isInteger(raw?.maxWasherSlotsPerDay)
            ? raw.maxWasherSlotsPerDay
            : fallbackSlots,
          maxDryerSlotsPerDay: Number.isInteger(raw?.maxDryerSlotsPerDay)
            ? raw.maxDryerSlotsPerDay
            : fallbackSlots,
          blockPastSlots: typeof raw?.blockPastSlots === 'boolean'
            ? raw.blockPastSlots
            : DEFAULT_SETTINGS.blockPastSlots,
          maxAdvanceDays: Number.isInteger(raw?.maxAdvanceDays) && raw.maxAdvanceDays >= 1 && raw.maxAdvanceDays <= 90
            ? raw.maxAdvanceDays
            : DEFAULT_SETTINGS.maxAdvanceDays,
        };
        const safe = validateSettings(candidate) ? DEFAULT_SETTINGS : candidate;
        setState({ ...safe, loading: false });
      },
      (error) => {
        logError('settings:read', error);
        setState((s) => ({ ...s, loading: false }));
      }
    );
    return () => unsubscribe();
  }, []);

  return state;
}
