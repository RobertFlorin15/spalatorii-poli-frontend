import { useState, useLayoutEffect, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'theme';

const getSystemTheme = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* localStorage indisponibil (ex. mod privat) */
  }
  return getSystemTheme();
};

/**
 * Returnează [theme, toggleTheme].
 * - prima dată folosește tema sistemului (telefon / browser)
 * - după ce utilizatorul apasă butonul, alegerea se salvează
 */
export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Aplică tema pe <html> înainte de randare, ca să nu apară un "flash"
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Dacă utilizatorul nu a ales manual, urmărește schimbările din sistem
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;

    const onChange = () => {
      let saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignoră */ }
      if (!saved) setTheme(media.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignoră */ }
      return next;
    });
  }, []);

  return [theme, toggleTheme];
}