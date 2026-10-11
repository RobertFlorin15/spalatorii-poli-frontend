import React, { useState } from 'react';
import MachineList from './MachineList';
import MachineCalendar from './MachineCalendar';

function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);

  return (
    <div className="min-h-screen bg-[#3a60a6] relative overflow-hidden font-sans text-gray-800">
      
      <div className="absolute top-[-10%] right-[-20%] w-[400px] h-[400px] rounded-full bg-[#2d4b8a] shadow-2xl opacity-90"></div>
      <div className="absolute bottom-[-15%] left-[-20%] w-[500px] h-[500px] rounded-full bg-[#1e366a] shadow-2xl"></div>
      <div className="absolute top-[30%] left-[-25%] w-[350px] h-[350px] rounded-full bg-[#4167b1] opacity-40"></div>

      <div className="relative z-10 w-full max-w-md mx-auto min-h-screen p-4 flex flex-col">
        <header className="text-center pt-8 pb-6">
          <h1 
            className="text-3xl font-extrabold text-white cursor-pointer drop-shadow-md tracking-wide" 
            onClick={() => setSelectedMachine(null)}
          >
            Spălătorie 
          </h1>
        </header>
        
        <main className="flex-1 flex flex-col w-full pb-8">
          {selectedMachine ? (
            <MachineCalendar 
              machine={selectedMachine} 
              onBack={() => setSelectedMachine(null)} 
            />
          ) : (
            <MachineList onSelectMachine={(machine) => setSelectedMachine(machine)} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;