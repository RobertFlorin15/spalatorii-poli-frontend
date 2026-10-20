import { DEV_MOCK_USER } from '../utils/config';

const KNOWN_ROLES = ['USER', 'ADMIN'];

function normalizeUser(raw) {
  if (!raw || raw.id == null) return null;
  const roles = (Array.isArray(raw.roles) ? raw.roles : [])
    .map((r) => String(r).replace(/^ROLE_/, '').toUpperCase())
    .filter((r) => KNOWN_ROLES.includes(r));
  return { id: String(raw.id), name: String(raw.name ?? ''), roles };
}

/** Returnează utilizatorul curent sau null dacă nu există sesiune. */
export async function getSession() {
  if (DEV_MOCK_USER) return normalizeUser(DEV_MOCK_USER);
  return null;
}

export async function logout() {
  // Placeholder pentru deconectare
}
