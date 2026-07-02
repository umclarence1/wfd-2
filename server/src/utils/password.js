const PASSWORD_MIN_LENGTH = 8;

export const validatePasswordStrength = (password) => {
  const value = String(password || '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return {
      valid: false,
      error: 'Password must include uppercase, lowercase, and a number.',
    };
  }
  return { valid: true };
};
