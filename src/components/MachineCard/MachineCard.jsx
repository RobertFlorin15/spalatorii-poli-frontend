import React, { useState, useEffect } from 'react';
import { bookingsApi } from '../../api';
import { logError } from '../../utils/logger';
import MachineIcon from '../MachineIcon/MachineIcon';

const MachineCard = ({ machine, onSelect }) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (!machine?.id) return;

    let bookings = [];

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

    // Primim doar intervalele ocupate (fără datele altor utilizatori)
    const unsubscribe = bookingsApi.subscribeMachineBookings(
      machine.id,
      (list) => {
        bookings = list;
        checkStatus();
      },
      (error) => logError('machine-card', error)
    );

    // recalculăm timpul rămas din minut în minut, fără cereri noi
    const interval = setInterval(checkStatus, 60000);

    return () => {
      unsubscribe();
      clearInterval(interval);
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
