import { useAuth } from '../../context/AuthContext';
import './LoginPage.scss';

/**
 * Pagina de autentificare (se afișează când nu există o sesiune activă).
 */
const LoginPage = () => {
  const { error } = useAuth();

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1 className="login-page__title">Spălătorie</h1>
        <p className="login-page__subtitle">Autentifică-te pentru a continua.</p>

        {error && (
          <p role="alert" className="login-page__error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
