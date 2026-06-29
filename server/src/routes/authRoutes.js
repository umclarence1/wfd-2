import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  generateAccessToken,
  generateRefreshToken,
  setTokenCookies,
  clearTokenCookies,
  storeRefreshToken,
  rotateRefreshToken,
  sendEmailVerification,
  sendPasswordReset,
} from '../services/authService.js';

const router = Router();

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required.', 400);
    }
    if (password.length < 8) throw new AppError('Password must be at least 8 characters.', 400);

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) throw new AppError('Email already registered.', 400);

    const user = await User.create({ name, email, phone, password });
    await sendEmailVerification(user);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user._id, refreshToken, req);
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified },
    });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password.', 401);
    }
    if (user.isBanned) throw new AppError('Your account has been banned.', 403);
    if (user.isSuspended) throw new AppError('Your account has been suspended.', 403);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user._id, refreshToken, req);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified },
    });
  })
);

router.post(
  '/admin/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password.', 401);
    }
    if (user.role !== 'admin') {
      throw new AppError('This account is not an admin.', 403);
    }
    if (user.isBanned) throw new AppError('Your account has been banned.', 403);
    if (user.isSuspended) throw new AppError('Your account has been suspended.', 403);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user._id, refreshToken, req);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await RefreshToken.findOneAndUpdate({ token: refreshToken }, { isRevoked: true });
    }
    clearTokenCookies(res);
    res.json({ success: true, message: 'Logged out successfully.' });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const oldToken = req.cookies?.refreshToken;
    if (!oldToken) throw new AppError('Refresh token required.', 401);

    const { accessToken, refreshToken } = await rotateRefreshToken(oldToken, req);
    setTokenCookies(res, accessToken, refreshToken);
    res.json({ success: true });
  })
);

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        isEmailVerified: req.user.isEmailVerified,
      },
    });
  })
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) throw new AppError('Invalid or expired verification link.', 400);

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully.' });
  })
);

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) await sendPasswordReset(user);
    res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
  })
);

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters.', 400);

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) throw new AppError('Invalid or expired reset link.', 400);

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully.' });
  })
);

router.post(
  '/change-password',
  protect,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      throw new AppError('Current password is incorrect.', 400);
    }
    if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters.', 400);

    user.password = newPassword;
    await user.save();
    clearTokenCookies(res);
    res.json({ success: true, message: 'Password changed. Please log in again.' });
  })
);

export default router;
