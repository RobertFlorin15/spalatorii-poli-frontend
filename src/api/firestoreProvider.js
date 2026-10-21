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

  subscribeMyBookings(onData, onError) {
    const uid = getSessionUserId();
    if (!uid) {
      onData([]);
      return () => {};
    }
    const q = query(collection(db, 'bookings'), where('userId', '==', uid));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => toBooking(d, uid))), onError);
  },

  subscribeAll(onData, onError) {
    const uid = getSessionUserId();
    return onSnapshot(
      collection(db, 'bookings'),
      (snap) => onData(snap.docs.map((d) => toBooking(d, uid))),
      onError
    );
  },

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

  async cancel(bookingId) {
    requireUser();
    await deleteDoc(doc(db, 'bookings', String(bookingId)));
  },

  async remove(bookingId) {
    requireUser();
    if (!bookingId) throw invalid();
    await deleteDoc(doc(db, 'bookings', String(bookingId)));
  },

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

  // Ora de final este cea a serverului, nu a ceasului din browser
  async release(bookingId) {
    requireUser();
    await updateDoc(doc(db, 'bookings', String(bookingId)), { endTime: serverTimestamp() });
  },
};

export const maintenanceApi = {
  subscribeAll(onData, onError) {
    return onSnapshot(
      collection(db, 'maintenance'),
      (snap) => onData(snap.docs.map((d) => toMaintenance(d))),
      onError
    );
  },

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

  async remove(maintenanceId) {
    requireUser();
    if (!maintenanceId) throw invalid();
    await deleteDoc(doc(db, 'maintenance', String(maintenanceId)));
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
