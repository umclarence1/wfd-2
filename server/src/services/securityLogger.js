const SENSITIVE_KEYS = /password|otp|token|pin|secret|authorization/i;

export const logSecurityEvent = (event, details = {}) => {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !SENSITIVE_KEYS.test(key))
  );
  console.warn(`[SECURITY] ${event}`, safeDetails);
};
