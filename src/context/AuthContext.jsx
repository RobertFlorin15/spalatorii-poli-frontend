import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSession, logout as logoutRequest } from '../api/authService';
import { setSessionUser } from '../api/session';
import { logError } from '../utils/logger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    getSession()
      .then((user) => {
        if (cancelled) return;
        setSessionUser(user);
        setState({ user, loading: false, error: null });
      })
      .catch((error) => {
        logError('auth:session', error);
        if (cancelled) return;
        setSessionUser(null);
        setState({ user: null, loading: false, error: 'Nu am putut verifica sesiunea. Încearcă din nou.' });
      });

    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (error) {
      logError('auth:logout', error);
    } finally {
      setSessionUser(null);
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  const value = useMemo(
    () => ({
      user: state.user,
      loading: state.loading,
      error: state.error,
      isAuthenticated: Boolean(state.user),
      isAdmin: Array.isArray(state.user?.roles) && state.user.roles.includes('ADMIN'),
      logout,
    }),
    [state, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth trebuie folosit în interiorul <AuthProvider>.');
  return ctx;
}
