import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import OTP from '../models/OTP.js';
import { generateOTP } from '../utils/reference.js';
import { sendOTPEmail, sendEmail, sendAdminLoginOTPEmail } from '../services/emailService.js';
import { AppError } from '../middleware/errorHandler.js';

const parseExpiry = (expiry) => {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(num) * multipliers[unit];
};

export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });
};

export const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

export const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProd = env.nodeEnv === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: parseExpiry(env.jwt.accessExpires),
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: parseExpiry(env.jwt.refreshExpires),
    path: '/api/auth/refresh',
  });
};

export const clearTokenCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};

export const storeRefreshToken = async (userId, token, req) => {
  const expiresAt = new Date(Date.now() + parseExpiry(env.jwt.refreshExpires));
  await RefreshToken.create({
    user: userId,
    token,
    expiresAt,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
};

export const rotateRefreshToken = async (oldToken, req) => {
  const stored = await RefreshToken.findOne({ token: oldToken, isRevoked: false });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH');
  }

  stored.isRevoked = true;
  const newToken = generateRefreshToken();
  stored.replacedBy = newToken;
  await stored.save();

  await storeRefreshToken(stored.user, newToken, req);
  const accessToken = generateAccessToken(stored.user);

  return { accessToken, refreshToken: newToken, userId: stored.user };
};

export const sendEmailVerification = async (user) => {
  const token = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  const verifyUrl = `${env.clientUrl}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify Your Email - Wilberforce Data Service',
    html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
  });
};

export const sendPasswordReset = async (user) => {
  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${env.clientUrl}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Password Reset - Wilberforce Data Service',
    html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
  });
};

export const maskEmail = (email) => {
  const [local, domain] = String(email || '').split('@');
  if (!domain) return '***';
  return `${local.charAt(0)}***@${domain}`;
};

export const createPendingAdminLoginToken = (userId) => {
  return jwt.sign({ id: userId, purpose: 'admin_login_pending' }, env.jwt.accessSecret, {
    expiresIn: '10m',
  });
};

export const verifyPendingAdminLoginToken = (token) => {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    if (decoded.purpose !== 'admin_login_pending' || !decoded.id) {
      throw new AppError('Login session expired. Please sign in again.', 401, 'INVALID_PENDING');
    }
    return decoded.id;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Login session expired. Please sign in again.', 401, 'INVALID_PENDING');
  }
};

export const createAndSendAdminLoginOTP = async () => {
  const otpEmail = env.adminOtpEmail?.toLowerCase();
  if (!otpEmail) {
    throw new AppError('Admin OTP email is not configured.', 500);
  }

  await OTP.updateMany(
    { email: otpEmail, purpose: 'admin_login', isUsed: false },
    { isUsed: true }
  );

  const otp = generateOTP();
  await OTP.create({
    email: otpEmail,
    otp,
    purpose: 'admin_login',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const mailResult = await sendAdminLoginOTPEmail(otpEmail, otp);
  const emailDelivered = mailResult.success !== false;

  if (!emailDelivered) {
    throw new AppError('Could not deliver admin login code. Try again shortly.', 503);
  }

  return { otpSentTo: maskEmail(otpEmail), emailDelivered };
};

export const verifyAdminLoginOTP = async (otp) => {
  const otpEmail = env.adminOtpEmail?.toLowerCase();
  if (!otpEmail) {
    throw new AppError('Admin OTP email is not configured.', 500);
  }
  await verifyOTP(otpEmail, String(otp || '').trim(), 'admin_login');
};

export const createAndSendOTP = async (email, purpose = 'order_history') => {
  const otp = generateOTP();
  await OTP.create({
    email: email.toLowerCase(),
    otp,
    purpose,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  await sendOTPEmail(email, otp);
  return { success: true };
};

export const verifyOTP = async (email, otp, purpose = 'order_history') => {
  const record = await OTP.findOne({
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) throw new AppError('Invalid or expired OTP.', 400, 'INVALID_OTP');

  record.attempts += 1;
  if (record.attempts > 5) throw new AppError('Too many attempts. Request a new OTP.', 400);

  const submitted = String(otp || '').trim();
  if (String(record.otp) !== submitted) {
    await record.save();
    throw new AppError('Invalid or expired OTP.', 400, 'INVALID_OTP');
  }

  record.isUsed = true;
  await record.save();
  return true;
};
