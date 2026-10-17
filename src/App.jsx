import React, { useState } from 'react';
import './theme.css';
import { useTheme } from './useTheme';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ThemeToggle from './ThemeToggle';
import SegmentedTabs from './SegmentedTabs';
import MachineList from './MachineList';
import MachineSchedule from './MachineSchedule';
import MyBookings from './MyBookings';
import AdminPanel from './AdminPanel';
import LoginPage from './LoginPage';

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


const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </svg>
);

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
    <div className="theme-fade min-h-screen bg-[color:var(--app-bg)] relative overflow-hidden font-sans text-[color:var(--on-bg)]">
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

      <div className="relative z-10 w-full max-w-md lg:max-w-5xl mx-auto min-h-screen p-4 lg:px-8 flex flex-col">
        <header className="relative text-center pt-8 pb-4">
          <h1
            className="text-3xl font-extrabold text-[color:var(--on-bg)] cursor-pointer drop-shadow-md tracking-wide"
            onClick={goToMachines}
          >
            Spălătorie
          </h1>

          {/* Butonul de admin: apare doar pentru administratori */}
          {isAdmin && (
            <div className="absolute top-6 left-0">
              <button
                type="button"
                onClick={goToAdmin}
                aria-label="Panou administrator"
                title="Panou administrator"
                aria-pressed={activeView === 'admin'}
                className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition ${
                  activeView === 'admin'
                    ? 'bg-[color:var(--tab-active-bg)] text-[color:var(--tab-active-text)] shadow-md'
                    : 'bg-[color:var(--toggle-bg)] text-[color:var(--toggle-icon)] hover:bg-[color:var(--toggle-hover)]'
                }`}
              >
                <SlidersIcon />
              </button>
            </div>
          )}

          <div className="absolute top-6 right-0">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* Navigare între pagini */}
        <nav className="mb-6 w-full lg:max-w-md lg:mx-auto" aria-label="Navigare principală">
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

        <main className="flex-1 flex flex-col w-full pb-8">
          <div key={`${activeView}-${selectedMachine?.id ?? 'list'}`} className="view-enter flex flex-1 flex-col w-full">
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
      <div className="min-h-screen bg-[color:var(--app-bg)] flex items-center justify-center text-[color:var(--on-bg)] font-bold">
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