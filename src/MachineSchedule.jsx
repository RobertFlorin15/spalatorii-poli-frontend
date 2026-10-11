import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import ro from 'date-fns/locale/ro';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Setari
const START_HOUR = 6;                        
const END_HOUR = 24;                         
const SLOT_MINUTES = 30;                     
const MAX_SLOTS = (2 * 60) / SLOT_MINUTES;   
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

const STYLES = `
.mc-root {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 85vh;
  height: 85dvh;
  padding: 16px;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(8, 15, 35, 0.35);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  color: #fff;
  font-family: inherit;
}
.mc-root, .mc-root *, .mc-root *::before, .mc-root *::after,
.mc-panel, .mc-panel *, .mc-modal, .mc-modal * { box-sizing: border-box; }

/* Antet */
.mc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.mc-back {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 12px; border: 0; border-radius: 12px;
  background: rgba(255, 255, 255, 0.08); color: #fff;
  font: inherit; font-weight: 700; cursor: pointer;
}
.mc-back-label { display: none; }
@media (min-width: 640px) { .mc-back-label { display: inline; } }
.mc-title {
  margin: 0 0 0 8px; min-width: 0;
  font-size: 1.5rem; font-weight: 800; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Navigare între zile */
.mc-daynav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px; margin-bottom: 8px;
  border: 1px solid rgba(148, 163, 184, 0.45); border-radius: 12px;
  background: rgba(15, 23, 42, 0.45);
}
.mc-daynav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px;
  background: transparent; color: #cbd5e1; cursor: pointer;
}
.mc-daynav-btn svg { width: 24px; height: 24px; }
.mc-daynav-label { display: flex; flex-direction: column; align-items: center; }
.mc-daynav-day { font-size: 0.875rem; font-weight: 700; text-transform: capitalize; }
.mc-daynav-date { font-size: 0.75rem; color: #cbd5e1; }
.mc-today-wrap { height: 20px; margin-bottom: 8px; text-align: center; }
.mc-today {
  padding: 0; border: 0; background: transparent; color: #7dd3fc;
  font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer;
}
.mc-today:hover { text-decoration: underline; }

/* Tabelul: ore în stânga, starea mașinii în dreapta */
.mc-table {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  border: 1px solid #1e293b; border-radius: 12px;
  background: #0f172a;
}
.mc-head, .mc-row { display: grid; grid-template-columns: 8.25rem 1fr; }
.mc-head {
  flex: none;
  background: #334155;
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
}
.mc-head > div { padding: 12px 16px; }
.mc-head-machine { text-align: center; }
.mc-body {
  flex: 1; min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.mc-body--padded { padding-bottom: 15rem; }
.mc-row { height: 48px; border-bottom: 1px solid #1e293b; }
.mc-time {
  display: flex; align-items: center;
  padding: 0 16px;
  font-size: 0.875rem; font-weight: 700; white-space: nowrap;
}
.mc-cell {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; margin: 0; padding: 0;
  border: 0; border-left: 4px solid transparent; border-radius: 0;
  font: inherit; font-size: 0.875rem; font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.mc-cell:disabled { cursor: not-allowed; opacity: 1; -webkit-text-fill-color: currentColor; }
.mc-cell--free     { background: #0f2a24; color: #22c55e; border-left-color: #22c55e; }
.mc-cell--busy     { background: #2a1520; color: #fca5a5; border-left-color: #ef4444; }
.mc-cell--mine     { background: #16294d; color: #bfdbfe; border-left-color: #60a5fa; }
.mc-cell--selected {
  background: rgba(14, 165, 233, 0.25); color: #e0f2fe; border-left-color: #38bdf8;
  box-shadow: inset 0 0 0 2px rgba(56, 189, 248, 0.7);
}
.mc-cell--past     { background: #0d1424; color: #475569; border-left-color: #334155; }
@media (hover: hover) {
  .mc-back:hover { background: rgba(255, 255, 255, 0.16); }
  .mc-daynav-btn:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
  .mc-cell--free:hover { background: #143629; }
  .mc-cell--mine:hover { background: #1c3563; }
}

/* Panou flotant de confirmare */
.mc-panel-wrap {
  position: fixed; left: 0; right: 0;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  display: flex; justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}
.mc-panel {
  width: 100%; max-width: 28rem;
  padding: 16px;
  border: 1px solid #475569; border-radius: 16px;
  background: rgba(15, 23, 42, 0.96);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  color: #fff; font-family: inherit;
  pointer-events: auto;
  animation: mc-slide-up 0.22s ease-out;
}
.mc-panel-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.mc-panel-sub { margin: 0; font-size: 0.875rem; color: #94a3b8; text-transform: capitalize; }
.mc-panel-range { margin: 4px 0 0; font-size: 1.25rem; font-weight: 800; line-height: 1.3; }
.mc-badge {
  flex: none; padding: 4px 8px; border-radius: 8px;
  background: rgba(14, 165, 233, 0.2); color: #bae6fd;
  font-size: 0.75rem; font-weight: 700; white-space: nowrap;
}
.mc-warn { margin: 0 0 12px; font-size: 0.75rem; font-weight: 600; color: #fbbf24; }
.mc-actions { display: flex; gap: 12px; }
.mc-btn {
  padding: 12px; border-radius: 12px;
  font: inherit; font-weight: 700; cursor: pointer;
  transition: transform 0.1s, background-color 0.15s;
}
.mc-btn:active { transform: scale(0.98); }
.mc-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.mc-btn--ghost { flex: 1; border: 2px solid #475569; background: transparent; color: #cbd5e1; }
.mc-btn--primary { flex: 2; border: 0; background: #3b5b9d; color: #fff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3); }
.mc-btn--primary:hover:not(:disabled) { background: #2d4b8a; }
.mc-btn--danger { width: 100%; border: 2px solid #ef4444; background: transparent; color: #f87171; }

/* Fereastra de anulare a rezervării proprii */
.mc-overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  background: rgba(2, 6, 23, 0.8);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
}
.mc-modal {
  position: relative;
  width: 100%; max-width: 24rem;
  padding: 24px;
  border: 1px solid #334155; border-radius: 16px;
  background: #0f172a;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  color: #fff; font-family: inherit;
  animation: mc-slide-up 0.22s ease-out;
}
.mc-modal-close {
  position: absolute; top: 10px; right: 16px;
  padding: 0; border: 0; background: transparent;
  color: #64748b; font-size: 1.75rem; line-height: 1; cursor: pointer;
}
.mc-modal-title { margin: 0 0 4px; font-size: 1.25rem; font-weight: 800; }
.mc-modal-sub { margin: 0 0 20px; font-size: 0.875rem; color: #94a3b8; text-transform: capitalize; }
.mc-modal-time {
  margin: 0 0 24px; padding: 16px;
  border: 1px solid #334155; border-radius: 12px;
  background: rgba(30, 41, 59, 0.7);
  text-align: center; font-size: 1.875rem; font-weight: 700; color: #bfdbfe;
}
.mc-modal-time span { margin: 0 4px; color: #64748b; }

@keyframes mc-slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .mc-panel, .mc-modal { animation: none; }
}
`;

const MachineCalendar = ({ machine, onBack }) => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [selectedKeys, setSelectedKeys] = useState([]); 
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const bodyRef = useRef(null);

  const currentUserId = "student-123";

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!machine?.id) return;
    const q = query(collection(db, 'bookings'), where('machineId', '==', machine.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.userId === currentUserId ? 'Rezervarea mea' : 'Ocupat',
          start: data.startTime.toDate(),
          end: data.endTime.toDate(),
          userId: data.userId,
          status: data.status
        };
      });
      setEvents(fetchedEvents);
    });
    return () => unsubscribe();
  }, [machine?.id]);

  const slots = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const d = currentDate.getDate();
    const total = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

    return Array.from({ length: total }, (_, i) => {
      const startMin = START_HOUR * 60 + i * SLOT_MINUTES;
      const start = new Date(y, m, d, 0, startMin);
      const end = new Date(y, m, d, 0, startMin + SLOT_MINUTES);
      return { key: start.getTime(), start, end };
    });
  }, [currentDate]);

  const slotStates = useMemo(() => {
    return slots.map(slot => {
      const event = events.find(e => slot.start < e.end && slot.end > e.start);
      if (event) {
        return { status: event.userId === currentUserId ? 'mine' : 'busy', event };
      }
      if (BLOCK_PAST_SLOTS && slot.end <= now) return { status: 'past' };
      return { status: 'free' };
    });
  }, [slots, events, now]);

  const selectedSlots = useMemo(
    () => slots.filter((slot, i) => slotStates[i].status === 'free' && selectedKeys.includes(slot.key)),
    [slots, slotStates, selectedKeys]
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
  }, [dayKey]);

  const handleSlotClick = (slot, state) => {
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

    try {
      await Promise.all(
        selectedRanges.map(range =>
          addDoc(collection(db, 'bookings'), {
            machineId: machine.id,
            userId: currentUserId,
            startTime: Timestamp.fromDate(range.start),
            endTime: Timestamp.fromDate(range.end),
            status: 'active',
            createdAt: Timestamp.now()
          })
        )
      );
      setSelectedKeys([]);
    } catch (error) {
      console.error("Eroare la crearea rezervării:", error);
      alert("Rezervarea nu a putut fi salvată. Încearcă din nou.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteModal(false);
    try {
      await deleteDoc(doc(db, 'bookings', selectedEvent.id));
    } catch (error) {
      console.error("Eroare la ștergerea rezervării:", error);
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
      <style>{STYLES}</style>

      {/* Antet */}
      <div className="mc-top">
        <button className="mc-back" onClick={onBack}>
          <span>←</span> <span className="mc-back-label">Înapoi</span>
        </button>
        <h2 className="mc-title">
          {machine.name} <span>{machine.type === 'washer' ? '🌊' : '💨'}</span>
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