import React, { useState } from 'react';
import './theme.css';
import { useTheme } from './useTheme';
import ThemeToggle from './ThemeToggle';
import SegmentedTabs from './SegmentedTabs';
import MachineList from './MachineList';
import MachineSchedule from './MachineSchedule';
import MyBookings from './MyBookings';

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
};

const BLOB_MOTION = 'transition-transform duration-[1400ms] ease-in-out motion-reduce:transition-none will-change-transform';

function App() {
  const [view, setView] = useState('machines'); // 'machines' | 'bookings'
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [theme, toggleTheme] = useTheme();

  const scene = view === 'bookings' ? 'bookings' : selectedMachine ? 'schedule' : 'machines';
  const [t1, t2, t3] = SCENES[scene];

  const goToMachines = () => {
    setSelectedMachine(null);
    setView('machines');
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
      {/* Cercurile se muta cand se schimba pagina */}
      <div
        aria-hidden="true"
        className={`fixed top-[-10%] right-[-20%] w-[400px] h-[400px] rounded-full bg-[color:var(--blob-1)] shadow-2xl opacity-90 ${BLOB_MOTION}`}
        style={{ transform: t1 }}
      ></div>
      <div
        aria-hidden="true"
        className={`fixed bottom-[-15%] left-[-20%] w-[500px] h-[500px] rounded-full bg-[color:var(--blob-2)] shadow-2xl ${BLOB_MOTION}`}
        style={{ transform: t2 }}
      ></div>
      <div
        aria-hidden="true"
        className={`fixed top-[30%] left-[-25%] w-[350px] h-[350px] rounded-full bg-[color:var(--blob-3)] opacity-40 ${BLOB_MOTION}`}
        style={{ transform: t3 }}
      ></div>

      <div className="relative z-10 w-full max-w-md mx-auto min-h-screen p-4 flex flex-col">
        <header className="relative text-center pt-8 pb-4">
          <h1
            className="text-3xl font-extrabold text-[color:var(--on-bg)] cursor-pointer drop-shadow-md tracking-wide"
            onClick={goToMachines}
          >
            Spălătorie
          </h1>

          <div className="absolute top-6 right-0">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </header>

        {/* Navigare între pagini */}
        <nav className="mb-6" aria-label="Navigare principală">
          <SegmentedTabs
            label="Pagini"
            value={view}
            onChange={handleNavChange}
            options={[
              { value: 'machines', label: 'Mașini' },
              { value: 'bookings', label: 'Rezervările mele' },
            ]}
          />
        </nav>

        <main className="flex-1 flex flex-col w-full pb-8">
          <div key={`${view}-${selectedMachine?.id ?? 'list'}`} className="view-enter flex flex-1 flex-col w-full">
          {view === 'bookings' ? (
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

export default App;