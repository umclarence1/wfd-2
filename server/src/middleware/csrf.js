import crypto from 'crypto';
import { env } from '../config/env.js';

const tokens = new Map();

export const generateCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now());
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,
  });
  return token;
};

export const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token.' });
  }

  // Clean old tokens periodically
  if (tokens.size > 10000) {
    const now = Date.now();
    for (const [key, time] of tokens.entries()) {
      if (now - time > 3600000) tokens.delete(key);
    }
  }

  next();
};

export const getCsrfToken = (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ success: true, csrfToken: token });
};
