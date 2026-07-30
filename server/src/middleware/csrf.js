import crypto from 'crypto';
import { env } from '../config/env.js';

const timingSafeEqualStr = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

export const generateCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf-token', token, {
    httpOnly: false,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'strict',
    maxAge: 60 * 60 * 1000,
    path: '/',
  });
  return token;
};

/**
 * Double-submit CSRF: cookie must match X-CSRF-Token (timing-safe).
 * Origin/Referer must match an allowed front-end origin when present.
 */
export const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || !timingSafeEqualStr(cookieToken, headerToken)) {
    return res.status(403).json({ success: false, message: 'Invalid CSRF token.' });
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (env.nodeEnv === 'production' && (origin || referer)) {
    const allowed = [
      env.clientUrl,
      'https://client-pied-chi-88.vercel.app',
      'https://wilberforcedataservice.com',
      'https://www.wilberforcedataservice.com',
    ].filter(Boolean);

    const source = origin || (() => {
      try {
        return new URL(referer).origin;
      } catch {
        return '';
      }
    })();

    if (source && !allowed.includes(source)) {
      return res.status(403).json({ success: false, message: 'Invalid CSRF origin.' });
    }
  }

  next();
};

export const getCsrfToken = (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ success: true, csrfToken: token });
};
