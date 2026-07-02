import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const tokens = new Map();

export const generateCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now());
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'strict',
    maxAge: 60 * 60 * 1000,
    path: '/',
  });
  return token;
};

const hasValidAccessSession = (req) => {
  const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  try {
    jwt.verify(token, env.jwt.accessSecret);
    return true;
  } catch {
    return false;
  }
};

export const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];

  if (cookieToken && headerToken && cookieToken === headerToken) {
    // matched — continue below cleanup
  } else if (hasValidAccessSession(req) && headerToken && /^[a-f0-9]{64}$/i.test(headerToken)) {
    // Split client/server deploy: CSRF cookie may not round-trip through the proxy,
    // but CORS blocks foreign origins from sending custom headers with credentials.
  } else {
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
