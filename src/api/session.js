let currentUser = null;

export const setSessionUser = (user) => {
  currentUser = user ?? null;
};

export const getSessionUser = () => currentUser;

export const getSessionUserId = () => currentUser?.id ?? null;
