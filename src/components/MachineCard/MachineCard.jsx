import { useState, useEffect } from 'react';
import { bookingsApi } from '../../api';
import { logError } from '../../utils/logger';
import MachineIcon from '../MachineIcon/MachineIcon';
import './MachineCard.scss';

const MachineCard = ({ machine, onSelect }) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const isDisabled = machine.enabled === false;

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

  const statusMod = isDisabled
    ? 'machine-card__status-value--disabled'
    : isAvailable
      ? 'machine-card__status-value--available'
      : 'machine-card__status-value--busy';

  const statusText = isDisabled
    ? 'Indisponibil (În mentenanță)'
    : isAvailable
      ? 'Disponibil'
      : 'În utilizare';

  return (
    <div className={`machine-card ${isDisabled ? 'machine-card--disabled' : ''}`}>
      <div className="machine-card__icon">
        <MachineIcon type={machine.type} size={34} />
      </div>

      <h3 className="machine-card__title">{machine.name}</h3>

      <p className="machine-card__status">
        Status:{' '}
        <span className={`machine-card__status-value ${statusMod}`}>
          {statusText}
        </span>
      </p>

      {!isDisabled && !isAvailable && (
        <div className="machine-card__timer">
          <p className="machine-card__timer-label">Timp estimat rămas</p>
          <p className="machine-card__timer-value">{timeRemaining} minute</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => !isDisabled && onSelect()}
        disabled={isDisabled}
        className="machine-card__btn"
      >
        {isDisabled ? 'Indisponibil' : 'Vezi Orarul & Rezervă'}
      </button>
    </div>
  );
};

export default MachineCard;
