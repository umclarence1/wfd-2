import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { csrfProtection, getCsrfToken } from './middleware/csrf.js';
import authRoutes from './routes/authRoutes.js';
import packageRoutes from './routes/packageRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import topdealsWebhookRoutes from './routes/topdealsWebhookRoutes.js';
import { getSiteSettings } from './services/siteSettingsService.js';

const noopIo = { emit: () => {}, on: () => {} };

const maintenanceCheck = async (req, res, next) => {
  if (
    req.path === '/api/health'
    || req.path === '/api/csrf-token'
    || req.path.startsWith('/api/cron')
    || req.path.startsWith('/api/webhooks')
    || req.path === '/api/payments/webhook'
  ) {
    return next();
  }
  try {
    const settings = await getSiteSettings(true);
    if (settings?.maintenanceMode) {
      return res.status(503).json({
        success: false,
        message: settings.maintenanceMessage,
        maintenance: true,
      });
    }
  } catch {
    // continue
  }
  next();
};

export const createApp = (io = noopIo) => {
  const app = express();
  app.set('trust proxy', 1);
  app.set('io', io);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.nodeEnv === 'production' ? undefined : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));

  app.use(cors({
    origin: env.nodeEnv === 'production'
      ? (origin, cb) => {
          const allowedOrigins = [
            env.clientUrl,
            'https://client-pied-chi-88.vercel.app',
            'https://wilberforcedataservice.com',
            'https://www.wilberforcedataservice.com',
          ].filter(Boolean);
          if (
            !origin
            || allowedOrigins.includes(origin)
            || /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
          ) {
            cb(null, true);
            return;
          }
          cb(null, false);
        }
      : (origin, cb) => cb(null, !origin || /^http:\/\/localhost:\d+$/.test(origin)),
    credentials: true,
  }));

  app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      const path = String(req.originalUrl || req.url || '');
      if (
        path.includes('/api/payments/webhook')
        || path.includes('/api/webhooks/topdeals')
      ) {
        req.rawBody = Buffer.from(buf);
      }
    },
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use(maintenanceCheck);

  app.get('/api/health', async (_req, res) => {
    try {
      await connectDB();
    } catch {
      // reported below via readyState
    }
    const dbState = mongoose.connection.readyState;
    const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[dbState] || 'unknown';
    res.json({
      success: true,
      message: 'Wilberforce Data Service API is running',
      database: dbStatus,
      env: process.env.NODE_ENV || 'development',
    });
  });

  app.get('/api/csrf-token', getCsrfToken);

  // Webhooks + cron before the general API limiter so status pushes are never throttle-blocked.
  app.use('/api/webhooks', topdealsWebhookRoutes);
  app.use('/api/cron', cronRoutes);
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/admin', csrfProtection, adminRoutes);

  app.use(errorHandler);

  return app;
};

export default createApp;
