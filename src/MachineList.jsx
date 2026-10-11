import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import MachineCard from './MachineCard';

const MachineList = ({ onSelectMachine }) => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'machines'), (snapshot) => {
      const machinesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMachines(machinesData);
      setLoading(false);
    }, (error) => {
      console.error("Eroare Firebase:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="text-center text-white mt-10">se incarca</div>;

  const washers = machines.filter(m => m.type === 'washer');
  const dryers = machines.filter(m => m.type === 'dryer');

  return (
    <div className="w-full flex flex-col gap-8">
      {/* masinile de spalat */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-white drop-shadow-sm px-2">Mașini de spălat</h2>
        <div className="flex flex-col gap-4">
          {washers.map(machine => (
            <MachineCard key={machine.id} machine={machine} onSelect={() => onSelectMachine(machine)} />
          ))}
        </div>
      </section>

      {/* uscatoarele */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-white drop-shadow-sm px-2">Uscătoare</h2>
        <div className="flex flex-col gap-4">
          {dryers.map(machine => (
            <MachineCard key={machine.id} machine={machine} onSelect={() => onSelectMachine(machine)} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default MachineList;