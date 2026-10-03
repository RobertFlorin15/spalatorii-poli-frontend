import React from 'react';
import MachineList from './MachineList';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {}
      <header className="max-w-7xl mx-auto px-6 mb-8">
        <h1 className="text-3xl font-extrabold text-blue-600">Spălătorie</h1>
      </header>
      
      <main>
        <MachineList />
      </main>
    </div>
  );
}

export default App;