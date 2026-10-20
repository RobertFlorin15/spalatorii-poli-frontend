let currentUserId = null;

export const setSessionUser = (user) => {
  currentUserId = user?.id ?? null;
};

export const getSessionUserId = () => currentUserId;
