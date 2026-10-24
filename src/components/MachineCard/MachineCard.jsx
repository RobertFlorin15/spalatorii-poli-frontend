import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { bookingsApi, maintenanceApi } from '../../api';
import { logError } from '../../utils/logger';
import MachineIcon from '../MachineIcon/MachineIcon';
import './MachineCard.scss';

const MachineCard = ({ machine, onSelect }) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [inMaintenanceNow, setInMaintenanceNow] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const isDisabled = machine.enabled === false;

  useEffect(() => {
    if (!machine?.id) return;

    let bookings = [];
    let maintenances = [];

    const checkStatus = () => {
      const now = new Date();
      const activeBooking = bookings.find(
        (b) => b.status !== 'cancelled' && now >= b.start && now < b.end
      );

      // Dacă există deja o programare activă acum, aceasta rămâne activă
      if (activeBooking) {
        setIsAvailable(false);
        setInMaintenanceNow(false);
        const diffMs = activeBooking.end.getTime() - now.getTime();
        setTimeRemaining(Math.ceil(diffMs / (1000 * 60)));
        return;
      }

      const dayKey = format(now, 'yyyy-MM-dd');
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const activeMaint = maintenances.some((m) => {
        const endDate = m.endDate || m.startDate;
        if (dayKey < m.startDate || dayKey > endDate) return false;
        return nowMin >= m.startMinutes && nowMin < m.endMinutes;
      });

      setInMaintenanceNow(activeMaint);
      setIsAvailable(!activeMaint);
      setTimeRemaining(0);
    };

    // CE SE CERE DE LA BACKEND:
    // 1. bookingsApi.subscribeMachineBookings: Rezervările active ale mașinii (pentru a calcula dacă e ocupată acum și cât timp a rămas)
    // 2. maintenanceApi.subscribeMachine: Perioadele de mentenanță ale mașinii (pentru a afișa dacă e în mentenanță)
    // CE SE TRIMITE CĂTRE BACKEND:
    // - Filtrele Firestore: where('machineId', '==', machine.id) pe colecțiile 'bookings' și 'maintenance'
    const unsubBookings = bookingsApi.subscribeMachineBookings(
      machine.id,
      (list) => {
        bookings = list;
        checkStatus();
      },
      (error) => logError('machine-card', error)
    );

    const unsubMaint = maintenanceApi.subscribeMachine(
      machine.id,
      (list) => {
        maintenances = list;
        checkStatus();
      },
      (error) => logError('machine-card:maintenance', error)
    );

    // recalculăm timpul rămas din minut în minut, fără cereri noi
    const interval = setInterval(checkStatus, 60000);

    return () => {
      unsubBookings();
      unsubMaint();
      clearInterval(interval);
    };
  }, [machine.id]);

  const statusMod = isDisabled || inMaintenanceNow
    ? 'machine-card__status-value--disabled'
    : isAvailable
      ? 'machine-card__status-value--available'
      : 'machine-card__status-value--busy';

  const statusText = isDisabled || inMaintenanceNow
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

      {!isDisabled && !isAvailable && !inMaintenanceNow && (
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
