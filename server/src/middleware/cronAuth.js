import crypto from 'crypto';

const safeEqualString = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

/**
 * Cron endpoints always require CRON_SECRET.
 * Do not trust x-vercel-cron alone — that header is spoofable off Vercel.
 */
export const cronAuth = (req, res, next) => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ success: false, message: 'Cron secret is not configured.' });
  }

  const auth = req.headers.authorization || '';
  const expected = `Bearer ${secret}`;
  if (!safeEqualString(auth, expected)) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  next();
};
