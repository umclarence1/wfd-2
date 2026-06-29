import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
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
import SiteSettings from './models/SiteSettings.js';

const noopIo = { emit: () => {}, on: () => {} };

const maintenanceCheck = async (req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/csrf-token') return next();
  try {
    const settings = await SiteSettings.findOne();
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
  app.set('io', io);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.nodeEnv === 'production' ? undefined : false,
  }));

  app.use(cors({
    origin: env.nodeEnv === 'production'
      ? env.clientUrl
      : (origin, cb) => cb(null, !origin || /^http:\/\/localhost:\d+$/.test(origin)),
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use('/api', apiLimiter);
  app.use(maintenanceCheck);

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'WDS API is running' });
  });

  app.get('/api/csrf-token', getCsrfToken);

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
