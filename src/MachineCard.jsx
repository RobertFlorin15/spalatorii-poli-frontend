import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import MachineIcon from './MachineIcon';

const MachineCard = ({ machine, onSelect }) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!machine?.id) return;

    let interval = null;

    // interogare la firebase pentru orele din bookings
    const q = query(collection(db, 'bookings'), where('machineId', '==', machine.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // conversia datelor de timp
      const bookings = snapshot.docs.map((doc) => ({
        start: doc.data().startTime.toDate(),
        end: doc.data().endTime.toDate(),
      }));

      const checkStatus = () => {
        const now = new Date();
        const activeBooking = bookings.find((b) => now >= b.start && now < b.end);

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

      // la fiecare snapshot nou oprim timerul vechi, ca să nu se adune mai multe
      if (interval) clearInterval(interval);
      interval = setInterval(checkStatus, 60000);
    });

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [machine.id]);

  return (
    <div className="theme-fade bg-[color:var(--card-bg)] border border-[color:var(--card-border)] p-6 rounded-2xl shadow-xl w-full flex flex-col items-center text-center transition-transform active:scale-[0.98]">
      <div className="w-16 h-16 bg-[color:var(--card-icon-bg)] rounded-full flex items-center justify-center mb-3 shadow-inner text-[color:var(--card-title)]">
        <MachineIcon type={machine.type} size={34} />
      </div>

      <h3 className="font-bold text-xl text-[color:var(--card-title)] mb-1">{machine.name}</h3>

      <p className="text-sm text-[color:var(--card-muted)] mb-5">
        Status:{' '}
        <span
          className={`font-bold ml-1 ${
            isAvailable ? 'text-[color:var(--ok)]' : 'text-[color:var(--busy-text)]'
          }`}
        >
          {isAvailable ? 'Disponibil' : 'În utilizare'}
        </span>
      </p>

      {!isAvailable && (
        <div className="w-full border border-[color:var(--card-inner-border)] bg-[color:var(--card-inner-bg)] rounded-lg py-2 mb-4 animate-fade-in">
          <p className="text-xs text-[color:var(--card-muted)] mb-1">Timp estimat rămas</p>
          <p className="font-bold text-[color:var(--timer)]">{timeRemaining} minute</p>
        </div>
      )}

      <button
        onClick={onSelect}
        className="w-full py-3 rounded-xl font-bold text-white transition-colors bg-[color:var(--btn-bg)] hover:bg-[color:var(--btn-hover)] active:bg-[color:var(--btn-active)] shadow-md"
      >
        Vezi Orarul &amp; Rezervă
      </button>
    </div>
  );
};

export default MachineCard;