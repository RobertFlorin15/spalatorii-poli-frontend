// Configurare centralizată pentru frontend.

export const IS_DEV = Boolean(import.meta.env?.DEV);

export const DEV_MOCK_USER = {
  id: 'dev-student',
  name: 'Student Test',
  roles: ['USER', 'ADMIN'],
};