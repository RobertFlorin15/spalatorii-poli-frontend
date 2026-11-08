import { Link, NavLink } from 'react-router-dom';
import { FiSliders } from 'react-icons/fi';
import RegulationsMenu from '../RegulationsMenu/RegulationsMenu';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './Navbar.scss';

const Navbar = ({ theme, toggleTheme, isAdmin }) => (
  <header className="app-navbar">
    <div className="app-navbar__inner">
      <Link to="/" className="app-navbar__brand">
        Spălătorie
      </Link>

      <div className="app-navbar__actions">
        {isAdmin && (
          <NavLink
            to="/admin"
            aria-label="Panou administrator"
            title="Panou administrator"
            className={({ isActive }) =>
              `app-navbar__admin-btn ${isActive ? 'app-navbar__admin-btn--active' : ''}`
            }
          >
            <FiSliders size={22} aria-hidden="true" />
          </NavLink>
        )}
        <RegulationsMenu />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
    </div>
  </header>
);

export default Navbar;
