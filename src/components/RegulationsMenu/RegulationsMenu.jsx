import { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiChevronUp, FiDownload } from 'react-icons/fi';
import './RegulationsMenu.scss';

const REGULATIONS_LIST = [
  {
    title: 'Curatarea sitelor',
    href: '/regulamente/curatarea-sitelor.pdf',
  },
  {
    title: 'Ghid programari',
    href: '/regulamente/ghid-programari.pdf',
  },
  {
    title: 'Ghid uscator',
    href: '/regulamente/ghid-uscator.pdf',
  },
  {
    title: 'Ghidul ciclurilor de spalare',
    href: '/regulamente/ghidul-ciclurilor-de-spalare.pdf',
  },
  {
    title: 'Manual Uscator',
    href: '/regulamente/manual-uscator.pdf',
  },
  {
    title: 'Regulament de utilizare a spalatoriei',
    href: '/regulamente/regulament-de-utilizare-a-spalatoriei.pdf',
  },
  {
    title: 'Regulament uscator',
    href: '/regulamente/regulament-uscator.pdf',
  },
];

const RegulationsMenu = () => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="regulations-menu">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={`regulations-menu__trigger ${open ? 'regulations-menu__trigger--open' : ''}`}
      >
        <span>Regulamente</span>
        {open ? (
          <FiChevronUp size={16} aria-hidden="true" className="regulations-menu__chevron" />
        ) : (
          <FiChevronDown size={16} aria-hidden="true" className="regulations-menu__chevron" />
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Regulamente PDF" className="regulations-menu__dropdown">
          {REGULATIONS_LIST.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="regulations-menu__item"
            >
              <FiDownload size={16} aria-hidden="true" className="regulations-menu__item-icon" />
              <span className="regulations-menu__item-text">{item.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegulationsMenu;
