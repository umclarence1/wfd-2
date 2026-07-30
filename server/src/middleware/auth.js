import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { AppError, asyncHandler } from './errorHandler.js';
import { ADMIN_ROLES, hasPermission } from '../config/permissions.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AppError('Not authorized. Please log in.', 401, 'UNAUTHORIZED');
  }

  const decoded = jwt.verify(token, env.jwt.accessSecret, { algorithms: ['HS256'] });
  const user = await User.findById(decoded.id).select('-password');

  if (!user) throw new AppError('User not found.', 401, 'UNAUTHORIZED');
  if (user.isBanned) throw new AppError('Your account has been banned.', 403, 'BANNED');
  if (user.isSuspended) throw new AppError('Your account has been suspended.', 403, 'SUSPENDED');

  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret, { algorithms: ['HS256'] });
    req.user = await User.findById(decoded.id).select('-password');
  } catch {
    // ignore invalid token
  }
  next();
});

export const adminOnly = (req, _res, next) => {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    throw new AppError('Admin access required.', 403, 'FORBIDDEN');
  }
  next();
};

export const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user || !hasPermission(req.user.role, permission)) {
    throw new AppError('You do not have permission for this action.', 403, 'FORBIDDEN');
  }
  next();
};

export const noCache = (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};
