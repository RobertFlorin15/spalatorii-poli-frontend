import React from 'react';
import { useAuth } from './auth/AuthContext';

/**
 * Pagina de autentificare (se afișează când nu există o sesiune activă).
 */
const LoginPage = () => {
  const { error } = useAuth();

  return (
    <div className="theme-fade min-h-screen bg-[color:var(--app-bg)] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-[color:var(--card-bg)] border border-[color:var(--card-border)] rounded-2xl p-6 text-center shadow-xl">
        <h1 className="text-2xl font-extrabold text-[color:var(--card-title)] mb-2">Spălătorie</h1>
        <p className="text-[color:var(--card-muted)]">Autentifică-te pentru a continua.</p>

        {error && (
          <p role="alert" className="mt-4 text-sm font-bold text-[color:var(--cal-danger)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;