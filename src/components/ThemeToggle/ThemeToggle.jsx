import { FiSun, FiMoon } from 'react-icons/fi';
import './ThemeToggle.scss';

const ThemeToggle = ({ theme, onToggle }) => {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Activează tema luminoasă' : 'Activează tema întunecată'}
      title={isDark ? 'Tema luminoasă' : 'Tema întunecată'}
      className="theme-toggle"
    >
      {isDark ? <FiSun size={22} aria-hidden="true" /> : <FiMoon size={22} aria-hidden="true" />}
    </button>
  );
};

export default ThemeToggle;
