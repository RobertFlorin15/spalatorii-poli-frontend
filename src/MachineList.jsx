import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import MachineCard from './MachineCard';

const MachineList = () => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const machinesCollectionRef = collection(db, 'machines');

    const unsubscribe = onSnapshot(machinesCollectionRef, (snapshot) => {
      const machinesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMachines(machinesData);
      setLoading(false);
    }, (error) => {
      console.error("Eroare la citirea din Firestore:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="p-6">Se încarcă aparatele...</div>;

  const washers = machines.filter(m => m.type === 'washer');
  const dryers = machines.filter(m => m.type === 'dryer');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Mașini de spălat</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
        {washers.length > 0 ? (
          washers.map(machine => <MachineCard key={machine.id} machine={machine} />)
        ) : (
          <p className="text-gray-500">Nu există mașini de spălat înregistrate.</p>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-6 text-gray-800">Uscătoare</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {dryers.length > 0 ? (
          dryers.map(machine => <MachineCard key={machine.id} machine={machine} />)
        ) : (
          <p className="text-gray-500">Nu există uscătoare înregistrate.</p>
        )}
      </div>
    </div>
  );
};

export default MachineList;