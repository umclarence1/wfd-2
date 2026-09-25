import crypto from 'crypto';
import { env } from '../config/env.js';

const timingSafeEqualStr = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const allowedOrigins = () =>
  [
    env.clientUrl,
    'https://client-pied-chi-88.vercel.app',
    'https://wilberforcedataservice.com',
    'https://www.wilberforcedataservice.com',
  ].filter(Boolean);

const requestOrigin = (req) => {
  if (req.headers.origin) return req.headers.origin;
  if (!req.headers.referer) return '';
  try {
    return new URL(req.headers.referer).origin;
  } catch {
    return '';
  }
};

export const generateCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  // Same-origin via Vercel rewrite — Lax is more reliable than None for cookie storage.
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'lax' : 'strict',
    maxAge: 60 * 60 * 1000,
    path: '/',
  });
  return token;
};

/**
 * Double-submit CSRF: the cookie must match X-CSRF-Token.
 * A logged-in session alone is not enough — that let any 64-character
 * header bypass the cookie check.
 */
export const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];
  const origin = requestOrigin(req);
  const localhostDev = env.nodeEnv !== 'production' && /^http:\/\/localhost:\d+$/.test(origin);
  const originOk = Boolean(origin) && (allowedOrigins().includes(origin) || localhostDev);

  if (!originOk) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF origin.' });
  }

  if (cookieToken && headerToken && timingSafeEqualStr(cookieToken, headerToken)) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Invalid CSRF token.' });
};

export const getCsrfToken = (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ success: true, csrfToken: token });
};
