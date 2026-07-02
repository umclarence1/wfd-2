import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { AppError } from '../middleware/errorHandler.js';
import { logSecurityEvent } from './securityLogger.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const assertAccountNotLocked = (user) => {
  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new AppError('Too many failed login attempts. Try again later.', 429, 'ACCOUNT_LOCKED');
  }
};

export const recordFailedLogin = async (user, req) => {
  if (!user) {
    logSecurityEvent('login_failed_unknown', { ip: req.ip, email: req.body?.email });
    return;
  }

  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    user.failedLoginAttempts = 0;
    logSecurityEvent('account_locked', { userId: user._id, ip: req.ip });
  }
  await user.save();
  logSecurityEvent('login_failed', { userId: user._id, ip: req.ip });
};

export const resetLoginAttempts = async (user) => {
  if (!user) return;
  if (user.failedLoginAttempts || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }
};

export const detectRefreshTokenReuse = async (stored) => {
  if (stored?.isRevoked && stored.replacedBy) {
    await RefreshToken.updateMany({ user: stored.user, isRevoked: false }, { isRevoked: true });
    logSecurityEvent('refresh_token_reuse', { userId: stored.user });
    throw new AppError('Session compromised. Please log in again.', 401, 'TOKEN_REUSE');
  }
};
