import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const MachineCard = ({ machine, onSelect }) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const isWasher = machine.type === 'washer';

  useEffect(() => {
    if (!machine?.id) return;

    // interogare la firebase pentru orele din bookings
    const q = query(collection(db, 'bookings'), where('machineId', '==', machine.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // conversia datelor de timp
      const bookings = snapshot.docs.map(doc => ({
        start: doc.data().startTime.toDate(),
        end: doc.data().endTime.toDate(),
      }));

      const checkStatus = () => {
        const now = new Date();
        
        const activeBooking = bookings.find(b => now >= b.start && now < b.end);

        if (activeBooking) {
          setIsAvailable(false);
          const diffMs = activeBooking.end.getTime() - now.getTime();
          setTimeRemaining(Math.ceil(diffMs / (1000 * 60)));
        } else {
          setIsAvailable(true);
          setTimeRemaining(0);
        }
      };

      checkStatus(); 
      
      // timer intern pentru recalculare timp (sa nu facem mereu calluri) - chiar merge
      const interval = setInterval(checkStatus, 60000);

      return () => {
        clearInterval(interval);
      };
    });

    return () => unsubscribe();
  }, [machine.id]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl w-full flex flex-col items-center text-center transition-transform active:scale-[0.98]">
      
      <div className="w-16 h-16 bg-[#eef2f6] rounded-full flex items-center justify-center mb-3 shadow-inner text-2xl">
        {isWasher ? '🌊' : '💨'}
      </div>
      
      <h3 className="font-bold text-xl text-[#2d4b8a] mb-1">{machine.name}</h3>
      
      <p className="text-sm text-gray-500 mb-5">
        Status: <span className={`font-bold ml-1 ${isAvailable ? 'text-green-600' : 'text-orange-500'}`}>
          {isAvailable ? 'Disponibil' : 'În utilizare'}
        </span>
      </p>

      {!isAvailable && (
        <div className="w-full border border-gray-100 bg-gray-50 rounded-lg py-2 mb-4 animate-fade-in">
          <p className="text-xs text-gray-500 mb-1">Timp estimat rămas</p>
          <p className="font-bold text-[#f59e0b]">{timeRemaining} minute</p>
        </div>
      )}

      <button
        onClick={onSelect}
        className="w-full py-3 rounded-xl font-bold text-white transition-colors bg-[#3b5b9d] hover:bg-[#2d4b8a] shadow-md active:bg-[#1e366a]"
      >
        Vezi Orarul & Rezervă
      </button>
    </div>
  );
};

export default MachineCard;