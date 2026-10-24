import { DEV_MOCK_USER } from '../utils/config';

const KNOWN_ROLES = ['USER', 'ADMIN'];

/**
 * Mapează și curăță obiectul utilizator primit de la backend.
 *
 * CE SE CERE / PRIMEȘTE DE LA BACKEND (obiectul `raw` de utilizator):
 * - raw.id: string | number (ID-ul unic al utilizatorului)
 * - raw.name: string (numele complet al studentului/administratorului)
 * - raw.room / raw.camera: string (numărul camerei/căminului)
 * - raw.roles: Array<string> (lista de roluri, ex: ['ROLE_USER', 'ROLE_ADMIN'] sau ['USER', 'ADMIN'])
 *
 * CE RETURNEAZĂ CĂTRE FRONTEND:
 * - { id: string, name: string, room: string, roles: Array<'USER' | 'ADMIN'> }
 */
function normalizeUser(raw) {
  if (!raw || raw.id == null) return null;
  const roles = (Array.isArray(raw.roles) ? raw.roles : [])
    .map((r) => String(r).replace(/^ROLE_/, '').toUpperCase())
    .filter((r) => KNOWN_ROLES.includes(r));
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    room: String(raw.room ?? raw.camera ?? ''),
    roles,
  };
}

/**
 * Obține datele sesiunii curente de la backend.
 *
 * CE SE TRIMITE CĂTRE BACKEND:
 * - Credențialele de sesiune (cookie HttpOnly / Authorization Bearer token transmise automat de browser / client).
 *
 * CE SE CERE / PRIMEȘTE DE LA BACKEND:
 * - Obiectul utilizatorului autentificat (cu proprietățile id, name, room/camera, roles).
 * - Dacă nu există o sesiune activă sau utilizatorul nu este autentificat, se returnează null / 401.
 */
export async function getSession() {
  if (DEV_MOCK_USER) return normalizeUser(DEV_MOCK_USER);
  return null;
}

/**
 * Închide sesiunea utilizatorului curent.
 *
 * CE SE TRIMITE CĂTRE BACKEND:
 * - Cerere de logout către endpoint-ul de autentificare (pentru invalidarea cookie-ului sau a sesiunii pe server).
 *
 * CE SE CERE DE LA BACKEND:
 * - Confirmarea invalidării sesiunii (răspuns 200 OK / 204 No Content).
 */
export async function logout() {
  // Placeholder pentru deconectare
}
