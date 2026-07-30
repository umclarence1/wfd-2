export const cronAuth = (req, res, next) => {
  // Vercel Cron invocations include this header.
  if (req.headers['x-vercel-cron'] === '1') {
    return next();
  }

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return res.status(503).json({ success: false, message: 'Cron secret is not configured.' });
  }

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  next();
};
