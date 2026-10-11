import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, subDays } from 'date-fns';
import ro from 'date-fns/locale/ro';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

const locales = { 'ro': ro };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const MachineCalendar = ({ machine, onBack }) => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [showBookModal, setShowBookModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditingTime, setIsEditingTime] = useState(false);

  const currentUserId = "student-123"; 

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
  }, [machine.id]);

  const checkOverlap = (newStart, newEnd) => {
    return events.some(event => newStart < event.end && newEnd > event.start);
  };

  const handleSelectSlot = (slotInfo) => {
    const start = slotInfo.start;

    // Asta e pt un bug dubios care ma lasa sa selectez intervalul 00:00 - 02:00 daca apasam sus, inainte de ora 6
    if (start.getHours() < 6) return;

    let end = slotInfo.end;

    // drag cu degetul pe ecran
    const diffMs = end.getTime() - start.getTime();
    //biblioteca functioneaza in milisecunde
    const maxMs = 2 * 60 * 60 * 1000;
      
    if (diffMs > maxMs) {
      // pt maxim 2h
      end = new Date(start.getTime() + maxMs);
    }
    

    // in cazul in care end-ul e peste o rezervare deja facuta, se modifica dupa timpul disponibil maxim in intervalul ala
    const nextEvent = events
      .filter(e => e.start > start)
      .sort((a, b) => a.start - b.start)[0];

    if (nextEvent && nextEvent.start < end) {
      end = nextEvent.start;
    }

    // sa nu fie in interiorul altei rezervari
    if (checkOverlap(start, end) || start >= end) {
      alert("Acest interval este invalid sau deja ocupat.");
      return;
    }

    setSelectedSlot({ start, end });
    setIsEditingTime(false);
    setShowBookModal(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    if (event.userId === currentUserId) {
      setShowDeleteModal(true);
    } else {
      alert("Acest interval este rezervat de altcineva.");
    }
  };

  const handleTimeChange = (type, timeString) => {
    const [hours, minutes] = timeString.split(':');
    const newDate = new Date(selectedSlot[type]);
    newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    setSelectedSlot(prev => ({ ...prev, [type]: newDate }));
  };

  const handleBook = async () => {
    const finalSlot = selectedSlot;
    setShowBookModal(false);

    try {
      await addDoc(collection(db, 'bookings'), {
        machineId: machine.id,
        userId: currentUserId,
        startTime: Timestamp.fromDate(finalSlot.start),
        endTime: Timestamp.fromDate(finalSlot.end),
        status: 'active',
        createdAt: Timestamp.now()
      });
    } catch (error) {
      console.error("Eroare la crearea rezervării:", error);
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

  const eventStyleGetter = (event) => {
    const isMine = event.userId === currentUserId;
    return {
      style: {
        backgroundColor: isMine ? '#3b5b9d' : '#e5e7eb',
        color: isMine ? 'white' : '#6b7280',
        borderRadius: '8px',
        border: isMine ? 'none' : '1px solid #d1d5db',
        display: 'flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontWeight: 'bold',
        fontSize: '0.85rem'
      }
    };
  };

  const goToPrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const goToNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isInvalidTime = selectedSlot && selectedSlot.start >= selectedSlot.end;
  const isOverlapping = selectedSlot && checkOverlap(selectedSlot.start, selectedSlot.end);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-xl w-full flex flex-col h-[85vh] overflow-hidden relative">
      
      <div className="flex items-center gap-2 mb-4">
        <button 
          onClick={onBack}
          className="text-[#3b5b9d] bg-blue-50 hover:bg-blue-100 p-2 px-3 rounded-xl font-bold transition-colors flex items-center gap-1"
        >
          <span>←</span> <span className="hidden sm:inline">Înapoi</span>
        </button>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#2d4b8a] ml-2 truncate">
          {machine.name} <span className="text-2xl">{machine.type === 'washer' ? '🌊' : '💨'}</span>
        </h2>
      </div>

      <div className="flex justify-between items-center bg-[#f8fafc] border border-gray-100 p-2 rounded-xl mb-4 shadow-sm">
        <button onClick={goToPrevDay} className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-black transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-[#2d4b8a] capitalize">
            {format(currentDate, 'EEEE', { locale: ro })}
          </span>
          <span className="text-xs text-gray-500">
            {format(currentDate, 'dd MMMM', { locale: ro })}
          </span>
        </div>

        <button onClick={goToNextDay} className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-black transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>
      </div>

      <div className="text-center mb-2">
         <button onClick={goToToday} className="text-xs text-blue-500 font-semibold hover:underline">Revino la ziua de azi</button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-gray-100 bg-white custom-scrollbar">
        <Calendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onNavigate={(date) => setCurrentDate(date)}
          startAccessor="start"
          endAccessor="end"
          selectable={true}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          toolbar={false}
          view="day"
          onView={() => {}}
          min={new Date(0, 0, 0, 6, 0, 0)}
          max={new Date(0, 0, 0, 23, 59, 0)}
          culture="ro"
          formats={{ timeGutterFormat: 'HH:mm' }}
        />
      </div>

      {showBookModal && (
        <div className="fixed inset-0 bg-[#0f172a] bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-fade-in-up">
            <button onClick={() => setShowBookModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-2xl font-light">×</button>
            
            <h3 className="text-xl font-extrabold text-[#2d4b8a] mb-1">Confirmare Rezervare</h3>
            <p className="text-gray-500 text-sm mb-5 capitalize">{format(selectedSlot.start, 'EEEE, dd MMM', { locale: ro })}</p>
            
            <div className="bg-[#f8fafc] border border-gray-100 p-4 rounded-xl mb-6">
              {!isEditingTime ? (
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold text-gray-800">
                    {format(selectedSlot.start, 'HH:mm')} <span className="text-gray-400 mx-1">-</span> {format(selectedSlot.end, 'HH:mm')}
                  </p>
                  <button onClick={() => setIsEditingTime(true)} className="text-[#3b5b9d] hover:text-[#2d4b8a] font-semibold text-sm bg-blue-50 px-3 py-1 rounded-lg">
                    Modifică
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-600">Început:</label>
                    <input type="time" value={format(selectedSlot.start, 'HH:mm')} onChange={(e) => handleTimeChange('start', e.target.value)} className="border border-gray-200 bg-white rounded-lg p-2 font-bold text-gray-800 outline-none focus:border-[#3b5b9d]"/>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-600">Final:</label>
                    <input type="time" value={format(selectedSlot.end, 'HH:mm')} onChange={(e) => handleTimeChange('end', e.target.value)} className="border border-gray-200 bg-white rounded-lg p-2 font-bold text-gray-800 outline-none focus:border-[#3b5b9d]"/>
                  </div>
                </div>
              )}
              {isInvalidTime && <p className="text-red-500 text-xs font-bold mt-3">Timpul de început trebuie să fie înainte de final.</p>}
              {isOverlapping && <p className="text-red-500 text-xs font-bold mt-3">Acest interval se suprapune cu o rezervare existentă.</p>}
            </div>

            <button 
              onClick={handleBook} disabled={isInvalidTime || isOverlapping}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all active:scale-[0.98] ${
                isInvalidTime || isOverlapping ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#3b5b9d] text-white hover:bg-[#2d4b8a]'
              }`}
            >
              Rezervă Acum
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-[#0f172a] bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-fade-in-up">
            <button onClick={() => setShowDeleteModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-2xl font-light">×</button>
            <h3 className="text-xl font-extrabold text-gray-800 mb-1">Rezervarea ta</h3>
            <p className="text-gray-500 text-sm mb-5 capitalize">{format(selectedEvent.start, 'EEEE, dd MMM', { locale: ro })}</p>
            <div className="bg-[#f8fafc] border border-gray-100 p-4 rounded-xl mb-6 text-center">
              <p className="text-3xl font-bold text-[#2d4b8a]">
                {format(selectedEvent.start, 'HH:mm')} <span className="text-gray-400 text-2xl mx-1">-</span> {format(selectedEvent.end, 'HH:mm')}
              </p>
            </div>
            <button 
              onClick={handleDelete}
              className="w-full bg-white border-2 border-red-500 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors shadow-sm active:scale-[0.98]"
            >
              Anulează Rezervarea
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachineCalendar;