import { useState, useEffect } from 'react';
import { settingsApi } from './data';
import { DEFAULT_SETTINGS, validateSettings } from './settingsModel';
import { logError } from './utils/logger';

/**
 * Citește setările (program + limită per rezervare).
 * Returnează { openMinutes, closeMinutes, maxSlots, loading }.
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
        const candidate = {
          openMinutes: raw?.openMinutes ?? DEFAULT_SETTINGS.openMinutes,
          closeMinutes: raw?.closeMinutes ?? DEFAULT_SETTINGS.closeMinutes,
          maxSlots: raw?.maxSlots ?? DEFAULT_SETTINGS.maxSlots,
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