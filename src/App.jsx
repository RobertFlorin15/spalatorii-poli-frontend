import { useState } from 'react';
import { FiSliders } from 'react-icons/fi';
import './theme.css';
import './App.scss';
import { useTheme } from './hooks/useTheme';
import { AuthProvider, useAuth } from './context/AuthContext';
import ThemeToggle from './components/ThemeToggle/ThemeToggle';
import SegmentedTabs from './components/SegmentedTabs/SegmentedTabs';
import MachineList from './pages/MachineList/MachineList';
import MachineSchedule from './pages/MachineSchedule/MachineSchedule';
import MyBookings from './pages/MyBookings/MyBookings';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import LoginPage from './pages/LoginPage/LoginPage';

// Poziția fiecărui cerc (în ordine: blob 1, 2, 3) pentru fiecare "scenă".
// Valorile în % sunt relative la dimensiunea cercului, deci arată la fel pe orice ecran.
const SCENES = {
  machines: [
    'translate(0%, 0%) scale(1)',
    'translate(0%, 0%) scale(1)',
    'translate(0%, 0%) scale(1)',
  ],
  schedule: [
    'translate(-35%, 40%) scale(1.1)',
    'translate(25%, -25%) scale(0.95)',
    'translate(45%, 25%) scale(1.1)',
  ],
  bookings: [
    'translate(-90%, 80%) scale(1.2)',
    'translate(70%, -60%) scale(0.9)',
    'translate(90%, -30%) scale(1.25)',
  ],
  admin: [
    'translate(-60%, 120%) scale(1.3)',
    'translate(40%, -90%) scale(1.1)',
    'translate(60%, 40%) scale(0.9)',
  ],
};

function AppShell({ theme, toggleTheme }) {
  const [view, setView] = useState('machines'); // 'machines' | 'bookings' | 'admin'
  const [selectedMachine, setSelectedMachine] = useState(null);

  // isAdmin vine din sesiunea confirmată de server. Aici doar ascunde/arată interfața;
  // serverul verifică din nou rolul la fiecare cerere către endpoint-urile de admin.
  const { isAdmin } = useAuth();

  // Dacă pierzi rolul de admin cât ești pe pagina de admin, te întoarcem la mașini
  const activeView = view === 'admin' && !isAdmin ? 'machines' : view;

  const scene = activeView === 'admin'
    ? 'admin'
    : activeView === 'bookings'
      ? 'bookings'
      : selectedMachine ? 'schedule' : 'machines';
  const [t1, t2, t3] = SCENES[scene];

  const goToMachines = () => {
    setSelectedMachine(null);
    setView('machines');
  };

  const goToAdmin = () => {
    setSelectedMachine(null);
    setView('admin');
  };

  const handleNavChange = (next) => {
    if (next === 'machines') goToMachines();
    else {
      setSelectedMachine(null);
      setView('bookings');
    }
  };

  return (
    <div className="app-shell">
      {/* Cercurile sunt fixe față de ecran (nu depind de înălțimea conținutului)
          și se mută animat când se schimbă pagina */}
      <div
        aria-hidden="true"
        className="bg-blob bg-blob-1"
        style={{ transform: t1 }}
      ></div>
      <div
        aria-hidden="true"
        className="bg-blob bg-blob-2"
        style={{ transform: t2 }}
      ></div>
      <div
        aria-hidden="true"
        className="bg-blob bg-blob-3"
        style={{ transform: t3 }}
      ></div>

      <div className="app-shell__container">
        <header className="app-shell__header">
          <h1 className="app-shell__brand" onClick={goToMachines}>
            Spălătorie
          </h1>

          {/* Butonul de admin: apare doar pentru administratori */}
          {isAdmin && (
            <div className="app-shell__header-left">
              <button
                type="button"
                onClick={goToAdmin}
                aria-label="Panou administrator"
                title="Panou administrator"
                aria-pressed={activeView === 'admin'}
                className={`app-shell__admin-btn ${
                  activeView === 'admin' ? 'app-shell__admin-btn--active' : ''
                }`}
              >
                <FiSliders size={22} aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="app-shell__header-right">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* Navigare între pagini */}
        <nav className="app-shell__nav" aria-label="Navigare principală">
          <SegmentedTabs
            label="Pagini"
            value={activeView}
            onChange={handleNavChange}
            options={[
              { value: 'machines', label: 'Mașini' },
              { value: 'bookings', label: 'Rezervările mele' },
            ]}
          />
        </nav>

        <main className="app-shell__main">
          <div key={`${activeView}-${selectedMachine?.id ?? 'list'}`} className="view-enter app-shell__view">
            {activeView === 'admin' ? (
              <AdminPanel />
            ) : activeView === 'bookings' ? (
              <MyBookings onGoToMachines={goToMachines} />
            ) : selectedMachine ? (
              <MachineSchedule
                machine={selectedMachine}
                onBack={() => setSelectedMachine(null)}
              />
            ) : (
              <MachineList onSelectMachine={(machine) => setSelectedMachine(machine)} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Poarta de acces: până când serverul nu confirmă sesiunea, nu se montează nicio pagină
 * și nu se face nicio cerere de date. La logout sau la 401, AppShell se demontează,
 * deci nu rămân în memorie date ale utilizatorului anterior.
 */
function Gate({ theme, toggleTheme }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-gate-loading">
        se incarca.
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <AppShell theme={theme} toggleTheme={toggleTheme} />;
}

function App() {
  const [theme, toggleTheme] = useTheme();

  return (
    <AuthProvider>
      <Gate theme={theme} toggleTheme={toggleTheme} />
    </AuthProvider>
  );
}

export default App;