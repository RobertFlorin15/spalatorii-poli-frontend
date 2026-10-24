import {
  collection, doc, query, where, onSnapshot, writeBatch,
  deleteDoc, updateDoc, setDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getSessionUser, getSessionUserId } from './session';
import { ApiError } from './errors';
import { validateSettings, DEFAULT_SETTINGS } from '../utils/settingsModel';

/**
 * Provider de date bazat pe Cloud Firestore.
 * Conține logica de comunicare cu backend-ul Firestore:
 * interogări (queries), ascultare în timp real (subscriptions) și modificări (create/update/delete).
 */

const MAX_SLOTS_PER_REQUEST = 48;

const requireUser = () => {
  const id = getSessionUserId();
  if (!id) throw new ApiError(401, 'UNAUTHENTICATED');
  return id;
};

const invalid = () => new ApiError(422, 'INVALID_REQUEST');

// "estimate": evită valori null cât timp serverTimestamp() nu s-a confirmat încă
const readData = (d) => d.data({ serverTimestamps: 'estimate' });

/**
 * Mapează un document brut din colecția 'bookings' la structura de date utilizată în frontend.
 *
 * CE SE CERE / PRIMEȘTE DE LA BACKEND (colecția 'bookings'):
 * - d.id: string (ID-ul unic al documentului de rezervare)
 * - data.machineId: string (ID-ul mașinii rezervate)
 * - data.startTime: Timestamp Firestore (momentul de început al intervalului)
 * - data.endTime: Timestamp Firestore (momentul de sfârșit al intervalului)
 * - data.status: string ('active' | 'cancelled')
 * - data.cancelReason: string (opțional - motivul anulării de către administrator)
 * - data.userName / data.name: string (numele utilizatorului care a rezervat)
 * - data.room / data.camera: string (camera utilizatorului)
 * - data.userId: string (ID-ul utilizatorului care deține rezervarea)
 *
 * CE RETURNEAZĂ CĂTRE FRONTEND:
 * - Obiect cu proprietăți normalizate: { id, machineId, start (Date), end (Date), status, cancelReason, userName, room, userId, mine (boolean) }
 */
const toBooking = (d, uid) => {
  const data = readData(d);
  return {
    id: d.id,
    machineId: String(data.machineId ?? ''),
    start: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
    end: data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime),
    status: String(data.status ?? 'active'),
    cancelReason: data.cancelReason ? String(data.cancelReason) : '',
    userName: String(data.userName ?? data.name ?? ''),
    room: String(data.room ?? data.camera ?? ''),
    userId: String(data.userId ?? ''),
    mine: uid != null && data.userId === uid,
  };
};

/**
 * Mapează un document brut din colecția 'maintenance' la structura utilizată în frontend.
 *
 * CE SE CERE / PRIMEȘTE DE LA BACKEND (colecția 'maintenance'):
 * - d.id: string (ID-ul documentului de mentenanță)
 * - data.machineId: string (ID-ul mașinii aflate în mentenanță)
 * - data.startDate: string în format 'YYYY-MM-DD' (data de început)
 * - data.endDate: string în format 'YYYY-MM-DD' (data de sfârșit)
 * - data.startMinutes: number (ora de început exprimată în minute de la miezul nopții, ex: 480 = 08:00)
 * - data.endMinutes: number (ora de sfârșit exprimată în minute de la miezul nopții, ex: 600 = 10:00)
 *
 * CE RETURNEAZĂ CĂTRE FRONTEND:
 * - Obiect cu proprietăți normalizate: { id, machineId, startDate, endDate, startMinutes, endMinutes }
 */
const toMaintenance = (d) => {
  const data = readData(d);
  const startDate = String(data.startDate ?? '');
  return {
    id: d.id,
    machineId: String(data.machineId ?? ''),
    startDate,
    endDate: String(data.endDate || startDate),
    startMinutes: Number(data.startMinutes ?? 0),
    endMinutes: Number(data.endMinutes ?? 0),
  };
};

export const machinesApi = {
  /**
   * Ascultă în timp real lista tuturor mașinilor.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - O referință către colecția 'machines' (fără filtre).
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real (onSnapshot) cu toate documentele din 'machines'.
   * - Din fiecare document se extrag:
   *   - id: string (ID-ul mașinii)
   *   - name: string (numele afișat, ex: "Mașina 1")
   *   - type: 'washer' | 'dryer' | null (tipul mașinii)
   *   - enabled: boolean (dacă mașina este activă/funcțională)
   */
  subscribe(onData, onError) {
    return onSnapshot(
      collection(db, 'machines'),
      (snap) =>
        onData(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name ?? ''),
              type: data.type === 'washer' || data.type === 'dryer' ? data.type : null,
              enabled: data.enabled !== false,
            };
          })
        ),
      onError
    );
  },

  /**
   * Activează sau dezactivează o mașină (acțiune de administrare).
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'machines/{machineId}'
   * - Payload de actualizare (updateDoc):
   *   - enabled: boolean (starea nouă de activare)
   *   - updatedAt: FieldValue (ora curentă a serverului - serverTimestamp())
   *   - updatedBy: string (ID-ul utilizatorului/administratorului logat)
   *
   * CE SE CERE DE LA BACKEND:
   * - Confirmarea executării cu succes a operațiunii de actualizare (Promise<void>).
   */
  async setEnabled(machineId, enabled) {
    const uid = requireUser();
    if (!machineId || typeof enabled !== 'boolean') throw invalid();
    await updateDoc(doc(db, 'machines', String(machineId)), {
      enabled,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  },
};

export const bookingsApi = {
  /**
   * Ascultă în timp real rezervările unei mașini specifice.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Interogare Firestore: query pe colecția 'bookings' cu clauza where('machineId', '==', machineId).
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real cu rezervările acelei mașini.
   * - Se preiau câmpurile startTime, endTime, status, etc., iar pe frontend se filtrează cele cu status !== 'cancelled'.
   */
  subscribeMachineBookings(machineId, onData, onError) {
    const uid = getSessionUserId();
    const q = query(collection(db, 'bookings'), where('machineId', '==', machineId));
    return onSnapshot(
      q,
      (snap) =>
        onData(
          snap.docs
            .map((d) => toBooking(d, uid))
            .filter((b) => b.status !== 'cancelled')
        ),
      onError
    );
  },

  /**
   * Ascultă în timp real rezervările proprii ale utilizatorului curent.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Interogare Firestore: query pe colecția 'bookings' cu clauza where('userId', '==', uid).
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real cu documentele rezervărilor create de utilizatorul logat.
   * - Fiecare document este mapat prin toBooking(d, uid).
   */
  subscribeMyBookings(onData, onError) {
    const uid = getSessionUserId();
    if (!uid) {
      onData([]);
      return () => {};
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', uid));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toBooking(d, uid))), onError);
  },

  /**
   * Ascultă în timp real toate rezervările din sistem (folosit în panoul de administrare).
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - O referință către întreaga colecție 'bookings' (fără filtrare pe utilizator sau mașină).
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real cu toate rezervările existente, mapate prin toBooking(d, uid).
   */
  subscribeAll(onData, onError) {
    const uid = getSessionUserId();
    return onSnapshot(
      collection(db, 'bookings'),
      (snap) => onData(snap.docs.map((d) => toBooking(d, uid))),
      onError
    );
  },

  /**
   * Creează una sau mai multe rezervări în mod atomic (batch write).
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Un lot de scriere (writeBatch) către colecția 'bookings'.
   * - Pentru fiecare interval din ranges ({ start: Date, end: Date }), un document cu câmpurile:
   *   - machineId: string (ID-ul mașinii rezervate)
   *   - userId: string (ID-ul utilizatorului curent)
   *   - userName: string (numele utilizatorului curent din sesiune)
   *   - room: string (camera utilizatorului curent din sesiune)
   *   - startTime: Timestamp (convertit din obiectul Date de start)
   *   - endTime: Timestamp (convertit din obiectul Date de sfârșit)
   *   - status: 'active' (starea inițială a rezervării)
   *   - createdAt: serverTimestamp() (marca temporală generată de server)
   *
   * CE SE CERE DE LA BACKEND:
   * - Validarea regulilor de securitate și confirmarea scrierii atomice (batch.commit() -> Promise<void>).
   */
  async create(machineId, ranges) {
    const uid = requireUser();
    const user = getSessionUser();
    if (!machineId || !Array.isArray(ranges) || ranges.length === 0 || ranges.length > MAX_SLOTS_PER_REQUEST) {
      throw invalid();
    }

    const batch = writeBatch(db);
    ranges.forEach(({ start, end }) => {
      if (!(start instanceof Date) || !(end instanceof Date) || !(start < end)) throw invalid();
      batch.set(doc(collection(db, 'bookings')), {
        machineId: String(machineId),
        userId: uid,
        userName: String(user?.name ?? ''),
        room: String(user?.room ?? ''),
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        status: 'active',
        createdAt: serverTimestamp(), // ora serverului, nu a clientului
      });
    });
    await batch.commit();
  },

  /**
   * Anulează o rezervare prin ștergerea documentului corespunzător.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'bookings/{bookingId}' prin deleteDoc.
   *
   * CE SE CERE DE LA BACKEND:
   * - Confirmarea ștergerii documentului (Promise<void>).
   */
  async cancel(bookingId) {
    requireUser();
    await deleteDoc(doc(db, 'bookings', String(bookingId)));
  },

  /**
   * Elimină definitiv o rezervare din baza de date (acțiune de administrare / curățare).
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'bookings/{bookingId}' prin deleteDoc.
   *
   * CE SE CERE DE LA BACKEND:
   * - Confirmarea ștergerii documentului (Promise<void>).
   */
  async remove(bookingId) {
    requireUser();
    if (!bookingId) throw invalid();
    await deleteDoc(doc(db, 'bookings', String(bookingId)));
  },

  /**
   * Anulează o rezervare din perspectiva administratorului, specificând un motiv.
   * În loc de ștergere, documentul este păstrat cu status 'cancelled' pentru istoric.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'bookings/{bookingId}'
   * - Payload de actualizare (updateDoc):
   *   - status: 'cancelled'
   *   - cancelReason: string (motivul anulării completat de admin)
   *   - cancelledAt: FieldValue (ora serverului - serverTimestamp())
   *   - cancelledBy: string (ID-ul administratorului care anulează)
   *
   * CE SE CERE DE LA BACKEND:
   * - Confirmarea actualizării documentului (Promise<void>).
   */
  async adminCancel(bookingId, reason) {
    const uid = requireUser();
    const cleanReason = String(reason ?? '').trim();
    if (!bookingId || !cleanReason) throw invalid();

    await updateDoc(doc(db, 'bookings', String(bookingId)), {
      status: 'cancelled',
      cancelReason: cleanReason,
      cancelledAt: serverTimestamp(),
      cancelledBy: uid,
    });
  },

  /**
   * Eliberează mai devreme mașina asociată unei rezervări în desfășurare.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'bookings/{bookingId}'
   * - Payload de actualizare (updateDoc):
   *   - endTime: FieldValue (ora serverului - serverTimestamp()), scurtând rezervarea până în prezentul serverului
   *
   * CE SE CERE DE LA BACKEND:
   * - Confirmarea actualizării documentului (Promise<void>).
   */
  async release(bookingId) {
    requireUser();
    await updateDoc(doc(db, 'bookings', String(bookingId)), { endTime: serverTimestamp() });
  },
};

export const maintenanceApi = {
  /**
   * Ascultă în timp real toate perioadele de mentenanță.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Referință către întreaga colecție 'maintenance'.
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real cu documentele de mentenanță, mapate prin toMaintenance(d).
   */
  subscribeAll(onData, onError) {
    return onSnapshot(
      collection(db, 'maintenance'),
      (snap) => onData(snap.docs.map((d) => toMaintenance(d))),
      onError
    );
  },

  /**
   * Ascultă în timp real perioadele de mentenanță pentru o mașină anume.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Interogare Firestore: query pe colecția 'maintenance' cu clauza where('machineId', '==', machineId).
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real cu documentele de mentenanță ale mașinii respective.
   */
  subscribeMachine(machineId, onData, onError) {
    if (!machineId) {
      onData([]);
      return () => {};
    }
    const q = query(collection(db, 'maintenance'), where('machineId', '==', String(machineId)));
    return onSnapshot(
      q,
      (snap) => onData(snap.docs.map((d) => toMaintenance(d))),
      onError
    );
  },

  /**
   * Înregistrează una sau mai multe perioade de mentenanță (batch write).
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Un lot de scriere (writeBatch) către colecția 'maintenance'.
   * - Pentru fiecare interval orar din ranges ({ startMinutes, endMinutes }):
   *   - machineId: string (ID-ul mașinii)
   *   - startDate: string ('YYYY-MM-DD')
   *   - endDate: string ('YYYY-MM-DD')
   *   - startMinutes: number (ora de început în minute)
   *   - endMinutes: number (ora de sfârșit în minute)
   *   - createdAt: serverTimestamp() (ora creării pe server)
   *   - createdBy: string (ID-ul administratorului)
   *
   * CE SE CERE DE LA BACKEND:
   * - Validarea regulilor și confirmarea scrierii lotului (batch.commit() -> Promise<void>).
   */
  async create({ machineId, startDate, endDate, ranges }) {
    const uid = requireUser();
    const cleanStart = String(startDate ?? '').trim();
    const cleanEnd = String(endDate || startDate || '').trim();

    if (
      !machineId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cleanStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cleanEnd) ||
      cleanEnd < cleanStart ||
      !Array.isArray(ranges) ||
      ranges.length === 0
    ) {
      throw invalid();
    }

    const batch = writeBatch(db);
    ranges.forEach(({ startMinutes, endMinutes }) => {
      if (
        !Number.isInteger(startMinutes) ||
        !Number.isInteger(endMinutes) ||
        startMinutes < 0 ||
        endMinutes > 24 * 60 ||
        startMinutes >= endMinutes
      ) {
        throw invalid();
      }
      batch.set(doc(collection(db, 'maintenance')), {
        machineId: String(machineId),
        startDate: cleanStart,
        endDate: cleanEnd,
        startMinutes,
        endMinutes,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
    });

    await batch.commit();
  },

  /**
   * Șterge o înregistrare de mentenanță.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'maintenance/{maintenanceId}' prin deleteDoc.
   *
   * CE SE CERE DE LA BACKEND:
   * - Confirmarea ștergerii documentului (Promise<void>).
   */
  async remove(maintenanceId) {
    requireUser();
    if (!maintenanceId) throw invalid();
    await deleteDoc(doc(db, 'maintenance', String(maintenanceId)));
  },
};

export const settingsApi = {
  /**
   * Ascultă în timp real setările globale de funcționare și rezervare ale spălătoriei.
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Referință către documentul unic 'settings/booking'.
   *
   * CE SE CERE / PRIMEȘTE DE LA BACKEND:
   * - Snapshot în timp real cu documentul 'settings/booking'.
   * - Câmpuri extrase:
   *   - openMinutes: number (ora de deschidere a spălătoriei în minute)
   *   - closeMinutes: number (ora de închidere a spălătoriei în minute)
   *   - maxSlots: number (numărul maxim de intervale consecutive permise)
   *   - maxWasherSlotsPerDay: number (numărul maxim de intervale de spălare / zi / student)
   *   - maxDryerSlotsPerDay: number (numărul maxim de intervale de uscare / zi / student)
   *   - blockPastSlots: boolean (dacă intervalele din trecut sunt blocate)
   *   - maxAdvanceDays: number (câte zile în avans se pot efectua rezervări)
   */
  subscribe(onData, onError) {
    return onSnapshot(
      doc(db, 'settings', 'booking'),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        onData({
          openMinutes: data.openMinutes,
          closeMinutes: data.closeMinutes,
          maxSlots: data.maxSlots,
          maxWasherSlotsPerDay: data.maxWasherSlotsPerDay,
          maxDryerSlotsPerDay: data.maxDryerSlotsPerDay,
          blockPastSlots: data.blockPastSlots,
          maxAdvanceDays: data.maxAdvanceDays,
        });
      },
      onError
    );
  },

  /**
   * Actualizează setările globale ale spălătoriei (acțiune permisă doar pentru ADMIN).
   *
   * CE SE TRIMITE CĂTRE BACKEND:
   * - Calea documentului: 'settings/booking' cu opțiunea { merge: true }
   * - Payload transmis:
   *   - openMinutes: number (opțional)
   *   - closeMinutes: number (opțional)
   *   - maxSlots: number (opțional)
   *   - maxWasherSlotsPerDay: number (opțional)
   *   - maxDryerSlotsPerDay: number (opțional)
   *   - blockPastSlots: boolean (opțional)
   *   - maxAdvanceDays: number (opțional)
   *   - updatedAt: FieldValue (ora serverului - serverTimestamp())
   *   - updatedBy: string (ID-ul administratorului care a făcut modificarea)
   *
   * CE SE CERE DE LA BACKEND:
   * - Validarea regulilor de securitate (drept de scriere pt rol de admin) și confirmarea salvării (Promise<void>).
   */
  async update(settings) {
    const uid = requireUser();
    const merged = {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
    if (validateSettings(merged)) throw new ApiError(422, 'INVALID_SETTINGS');

    const payload = {
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    };
    if (settings.openMinutes !== undefined) payload.openMinutes = settings.openMinutes;
    if (settings.closeMinutes !== undefined) payload.closeMinutes = settings.closeMinutes;
    if (settings.maxSlots !== undefined) payload.maxSlots = settings.maxSlots;
    if (settings.maxWasherSlotsPerDay !== undefined) payload.maxWasherSlotsPerDay = settings.maxWasherSlotsPerDay;
    if (settings.maxDryerSlotsPerDay !== undefined) payload.maxDryerSlotsPerDay = settings.maxDryerSlotsPerDay;
    if (settings.blockPastSlots !== undefined) payload.blockPastSlots = settings.blockPastSlots;
    if (settings.maxAdvanceDays !== undefined) payload.maxAdvanceDays = settings.maxAdvanceDays;

    await setDoc(doc(db, 'settings', 'booking'), payload, { merge: true });
  },
};
