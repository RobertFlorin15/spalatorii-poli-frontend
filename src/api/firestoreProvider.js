import {
  collection, doc, query, where, onSnapshot, writeBatch,
  deleteDoc, updateDoc, setDoc, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getSessionUserId } from './session';
import { ApiError } from './errors';
import { validateSettings, DEFAULT_SETTINGS } from '../utils/settingsModel';

/**
 * Provider de date bazat pe Cloud Firestore.
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

// În UI ajunge doar "mine: true/false", niciodată userId-ul altcuiva
const toBooking = (d, uid) => {
  const data = readData(d);
  return {
    id: d.id,
    machineId: String(data.machineId ?? ''),
    start: data.startTime.toDate(),
    end: data.endTime.toDate(),
    mine: uid != null && data.userId === uid,
  };
};

export const machinesApi = {
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
  subscribeMachineBookings(machineId, onData, onError) {
    const uid = getSessionUserId();
    const q = query(collection(db, 'bookings'), where('machineId', '==', machineId));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toBooking(d, uid))), onError);
  },

  subscribeMyBookings(onData, onError) {
    const uid = getSessionUserId();
    if (!uid) {
      onData([]);
      return () => {};
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', uid));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toBooking(d, uid))), onError);
  },

  async create(machineId, ranges) {
    const uid = requireUser();
    if (!machineId || !Array.isArray(ranges) || ranges.length === 0 || ranges.length > MAX_SLOTS_PER_REQUEST) {
      throw invalid();
    }

    const batch = writeBatch(db);
    ranges.forEach(({ start, end }) => {
      if (!(start instanceof Date) || !(end instanceof Date) || !(start < end)) throw invalid();
      batch.set(doc(collection(db, 'bookings')), {
        machineId: String(machineId),
        userId: uid,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        status: 'active',
        createdAt: serverTimestamp(), // ora serverului, nu a clientului
      });
    });
    await batch.commit();
  },

  async cancel(bookingId) {
    requireUser();
    await deleteDoc(doc(db, 'bookings', String(bookingId)));
  },

  // Ora de final este cea a serverului, nu a ceasului din browser
  async release(bookingId) {
    requireUser();
    await updateDoc(doc(db, 'bookings', String(bookingId)), { endTime: serverTimestamp() });
  },
};

export const settingsApi = {
  subscribe(onData, onError) {
    return onSnapshot(
      doc(db, 'settings', 'booking'),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        onData({
          openMinutes: data.openMinutes,
          closeMinutes: data.closeMinutes,
          maxSlots: data.maxSlots,
          blockPastSlots: data.blockPastSlots,
          maxAdvanceDays: data.maxAdvanceDays,
        });
      },
      onError
    );
  },

  // Verificarea rolului ADMIN nu se poate face aici: trebuie făcută de server / reguli -> tot claude zice asta
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
    if (settings.blockPastSlots !== undefined) payload.blockPastSlots = settings.blockPastSlots;
    if (settings.maxAdvanceDays !== undefined) payload.maxAdvanceDays = settings.maxAdvanceDays;

    await setDoc(doc(db, 'settings', 'booking'), payload, { merge: true });
  },
};
