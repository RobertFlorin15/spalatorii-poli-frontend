import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import './theme.css';
import './App.scss';
import { useTheme } from './hooks/useTheme';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar/Navbar';
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

function getSceneFromPath(pathname) {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/rezervari')) return 'bookings';
  if (pathname.startsWith('/masini/')) return 'schedule';
  return 'machines';
}

function AppShell({ theme, toggleTheme }) {
  const location = useLocation();
  const navigate = useNavigate();

  // isAdmin vine din sesiunea confirmată de server. Aici doar ascunde/arată interfața;
  // serverul verifică din nou rolul la fiecare cerere către endpoint-urile de admin.
  const { isAdmin } = useAuth();

  const activeView = location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/rezervari')
      ? 'bookings'
      : 'machines';

  const scene = getSceneFromPath(location.pathname);
  const [t1, t2, t3] = SCENES[scene];

  const handleNavChange = (next) => {
    if (next === 'bookings') navigate('/rezervari');
    else navigate('/');
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

      <Navbar
        theme={theme}
        toggleTheme={toggleTheme}
        isAdmin={isAdmin}
      />

      <div className="app-shell__container">
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
          <div key={location.pathname} className="view-enter app-shell__view">
            <Routes>
              <Route path="/" element={<MachineList />} />
              <Route path="/masini" element={<Navigate to="/" replace />} />
              <Route path="/masini/:machineId" element={<MachineSchedule />} />
              <Route path="/rezervari" element={<MyBookings />} />
              <Route
                path="/admin"
                element={isAdmin ? <AdminPanel /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
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

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<AppShell theme={theme} toggleTheme={toggleTheme} />} />
    </Routes>
  );
}

function App() {
  const [theme, toggleTheme] = useTheme();

  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate theme={theme} toggleTheme={toggleTheme} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
