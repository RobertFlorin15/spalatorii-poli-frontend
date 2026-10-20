import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import ro from 'date-fns/locale/ro';
import { bookingsApi } from '../../api';
import { userMessage } from '../../api/errors';
import { logError } from '../../utils/logger';
import MachineIcon from '../../components/MachineIcon/MachineIcon';
import { useSettings } from '../../hooks/useSettings';
import { SLOT_MINUTES } from '../../utils/settingsModel';
import './MachineSchedule.scss';

// Setări fixe. Programul și limita per rezervare vin din Firestore (vezi useSettings)
const BLOCK_PAST_SLOTS = true;
const ROW_HEIGHT = 48;

const CELL_LABELS = {
  free: 'Disponibil',
  busy: 'Ocupat',
  mine: 'Rezervarea mea',
  selected: '✓ Selectat',
  past: 'Trecut',
};

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h}h`, m && `${m}min`].filter(Boolean).join(' ');
};

const Portal = ({ children }) => createPortal(children, document.body);

const MachineCalendar = ({ machine, onBack }) => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bookError, setBookError] = useState(null);
  const bodyRef = useRef(null);

  // Setările setate de administrator (se actualizează în timp real)
  const { openMinutes, closeMinutes, maxSlots: MAX_SLOTS } = useSettings();


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!machine?.id) return;
    // Primim doar intervale (început, sfârșit, "mine: da/nu"), fără id-urile altor utilizatori
    const unsubscribe = bookingsApi.subscribeMachineBookings(
      machine.id,
      (list) => setEvents(list),
      (error) => logError('calendar', error)
    );
    return () => unsubscribe();
  }, [machine?.id]);

  const slots = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();
    const total = (closeMinutes - openMinutes) / SLOT_MINUTES;

    return Array.from({ length: total }, (_, i) => {
      const startMin = openMinutes + i * SLOT_MINUTES;
      const start = new Date(y, m, d, 0, startMin);
      const end = new Date(y, m, d, 0, startMin + SLOT_MINUTES);
      return { key: start.getTime(), start, end };
    });
  }, [currentDate, openMinutes, closeMinutes]);

  const slotStates = useMemo(() => {
    return slots.map(slot => {
      const event = events.find(e => slot.start < e.end && slot.end > e.start);
      if (event) {
        return { status: event.mine ? 'mine' : 'busy', event };
      }
      if (BLOCK_PAST_SLOTS && slot.end <= now) return { status: 'past' };
      return { status: 'free' };
    });
  }, [slots, events, now]);

  const selectedSlots = useMemo(
    () => slots
      .filter((slot, i) => slotStates[i].status === 'free' && selectedKeys.includes(slot.key))
      .slice(0, MAX_SLOTS),
    [slots, slotStates, selectedKeys, MAX_SLOTS]
  );

  const selectedRanges = useMemo(() => {
    const ranges = [];
    selectedSlots.forEach(slot => {
      const last = ranges[ranges.length - 1];
      if (last && last.end.getTime() === slot.start.getTime()) {
        last.end = slot.end;
      } else {
        ranges.push({ start: slot.start, end: slot.end });
      }
    });
    return ranges;
  }, [selectedSlots]);

  const totalMinutes = selectedSlots.length * SLOT_MINUTES;
  const limitReached = selectedSlots.length >= MAX_SLOTS;
  const isToday = isSameDay(currentDate, now);
  const dayKey = format(currentDate, 'yyyy-MM-dd');

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (!isSameDay(currentDate, new Date())) {
      body.scrollTop = 0;
      return;
    }
    const idx = slots.findIndex(s => s.end > new Date());
    body.scrollTop = (idx === -1 ? slots.length : idx) * ROW_HEIGHT;
  }, [dayKey, openMinutes]);

  const handleSlotClick = (slot, state) => {
    setBookError(null);
    if (state.status === 'mine') {
      setSelectedEvent(state.event);
      setShowDeleteModal(true);
      return;
    }
    if (state.status !== 'free') return;

    if (selectedKeys.includes(slot.key)) {
      setSelectedKeys(selectedKeys.filter(k => k !== slot.key));
      return;
    }
    if (selectedSlots.length >= MAX_SLOTS) return;

    setSelectedKeys([...selectedKeys, slot.key]);
  };

  const handleBook = async () => {
    if (selectedRanges.length === 0 || isSaving) return;
    setIsSaving(true);
    setBookError(null);

    try {
      // O singură cerere atomică. Serverul verifică programul, limita, suprapunerile și ora.
      await bookingsApi.create(machine.id, selectedRanges);
      setSelectedKeys([]);
    } catch (error) {
      logError('booking:create', error);
      setBookError(userMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const target = selectedEvent;
    setShowDeleteModal(false);
    if (!target) return;

    try {
      await bookingsApi.cancel(target.id);
    } catch (error) {
      logError('booking:cancel', error);
      setBookError(userMessage(error));
    }
  };

  const changeDay = (date) => {
    setCurrentDate(date);
    setSelectedKeys([]);
  };
  const goToPrevDay = () => changeDay(subDays(currentDate, 1));
  const goToNextDay = () => changeDay(addDays(currentDate, 1));
  const goToToday = () => changeDay(new Date());

  return (
    <div className="mc-root">
      {/* Antet */}
      <div className="mc-top">
        <button className="mc-back" onClick={onBack} aria-label="Înapoi">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="mc-back-label">Înapoi</span>
        </button>
        <h2 className="mc-title">
          {machine.name}
          <MachineIcon
            type={machine.type}
            size={24}
            style={{ display: 'inline-block', verticalAlign: '-4px', marginLeft: 10, opacity: 0.85 }}
          />
        </h2>
      </div>

      {/* Navigare prin zile */}
      <div className="mc-daynav">
        <button className="mc-daynav-btn" onClick={goToPrevDay} aria-label="Ziua anterioară">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>

        <div className="mc-daynav-label">
          <span className="mc-daynav-day">{format(currentDate, 'EEEE', { locale: ro })}</span>
          <span className="mc-daynav-date">{format(currentDate, 'dd MMMM', { locale: ro })}</span>
        </div>

        <button className="mc-daynav-btn" onClick={goToNextDay} aria-label="Ziua următoare">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      <div className="mc-today-wrap">
        {!isToday && (
          <button className="mc-today" onClick={goToToday}>Revino la ziua de azi</button>
        )}
      </div>

      {bookError && selectedSlots.length === 0 && (
        <p className="mc-warn" role="alert">{bookError}</p>
      )}

      {/* Forma tabelului */}
      <div className="mc-table">
        <div className="mc-head">
          <div>Interval orar</div>
          <div className="mc-head-machine">{machine.name}</div>
        </div>

        <div ref={bodyRef} className={`mc-body ${selectedSlots.length > 0 ? 'mc-body--padded' : ''}`}>
          {slots.map((slot, i) => {
            const state = slotStates[i];
            const isSelected = state.status === 'free' && selectedKeys.includes(slot.key);
            const styleKey = isSelected ? 'selected' : state.status;
            const isDisabled = state.status === 'busy' || state.status === 'past';

            return (
              <div key={slot.key} className="mc-row">
                <div className="mc-time">
                  {format(slot.start, 'HH:mm')} - {format(slot.end, 'HH:mm')}
                </div>
                <button
                  type="button"
                  className={`mc-cell mc-cell--${styleKey}`}
                  disabled={isDisabled}
                  aria-pressed={state.status === 'free' ? isSelected : undefined}
                  onClick={() => handleSlotClick(slot, state)}
                >
                  {CELL_LABELS[styleKey]}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panou confirmare */}
      {selectedSlots.length > 0 && (
        <Portal>
          <div className="mc-panel-wrap">
            <div className="mc-panel">
              <div className="mc-panel-top">
                <div>
                  <p className="mc-panel-sub">
                    Rezervare nouă, {format(currentDate, 'EEEE, dd MMM', { locale: ro })}
                  </p>
                  {selectedRanges.map(range => (
                    <p key={range.start.getTime()} className="mc-panel-range">
                      {format(range.start, 'HH:mm')} - {format(range.end, 'HH:mm')}
                    </p>
                  ))}
                </div>
                <span className="mc-badge">{formatDuration(totalMinutes)}</span>
              </div>

              {limitReached && (
                <p className="mc-warn">
                  Ai atins limita de {formatDuration(MAX_SLOTS * SLOT_MINUTES)} pe rezervare.
                </p>
              )}

              {bookError && (
                <p className="mc-warn" role="alert">{bookError}</p>
              )}

              <div className="mc-actions">
                <button className="mc-btn mc-btn--ghost" onClick={() => setSelectedKeys([])} disabled={isSaving}>
                  Anulează
                </button>
                <button className="mc-btn mc-btn--primary" onClick={handleBook} disabled={isSaving}>
                  {isSaving ? 'Se salvează...' : 'Confirmă rezervarea'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Anulare */}
      {showDeleteModal && selectedEvent && (
        <Portal>
          <div className="mc-overlay">
            <div className="mc-modal">
              <button className="mc-modal-close" onClick={() => setShowDeleteModal(false)} aria-label="Închide">×</button>
              <h3 className="mc-modal-title">Rezervarea ta</h3>
              <p className="mc-modal-sub">{format(selectedEvent.start, 'EEEE, dd MMM', { locale: ro })}</p>
              <p className="mc-modal-time">
                {format(selectedEvent.start, 'HH:mm')} <span>-</span> {format(selectedEvent.end, 'HH:mm')}
              </p>
              <button className="mc-btn mc-btn--danger" onClick={handleDelete}>
                Anulează Rezervarea
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

export default MachineCalendar;
