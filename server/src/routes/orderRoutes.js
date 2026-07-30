import { Router } from 'express';
import Order from '../models/Order.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { optionalAuth, protect, noCache } from '../middleware/auth.js';
import { paymentLimiter, otpLimiter, promoLimiter } from '../middleware/rateLimit.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  orderCreateSchema,
  orderValidateSchema,
  paymentReferenceSchema,
  otpRequestSchema,
  otpVerifySchema,
} from '../schemas/zodSchemas.js';
import {
  validateOrderInput,
  createOrder,
  processFreeOrder,
  getPaymentBreakdown,
} from '../services/orderService.js';
import { initializePayment, getPublicKey, verifyPayment } from '../services/paystackService.js';
import { markOrderPaidFromPaystack } from '../services/paymentProcessingService.js';
import { createAndSendOTP, verifyOTP } from '../services/authService.js';
import { validateEmail } from '../utils/validation.js';
import { sanitizeOrderForCustomer } from '../utils/customerSafe.js';

const router = Router();

const sanitizeOrder = (order, options = {}) => sanitizeOrderForCustomer(order, options);

router.post(
  '/validate',
  noCache,
  promoLimiter,
  optionalAuth,
  validateBody(orderValidateSchema),
  asyncHandler(async (req, res) => {
    const validated = await validateOrderInput(req.body, req.user);
    const breakdown = getPaymentBreakdown(validated.pkg.price, validated.promoResult);
    res.json({ success: true, breakdown, package: validated.pkg });
  })
);

router.post(
  '/create',
  noCache,
  paymentLimiter,
  optionalAuth,
  validateBody(orderCreateSchema),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key']?.slice(0, 64) || null;
    const validated = await validateOrderInput(req.body, req.user);
    const order = await createOrder({ ...validated, afaDetails: req.body.afaDetails }, req.user, idempotencyKey);

    if (validated.pricing.isFreeOrder === true) {
      await processFreeOrder(order, validated.promoResult, req.user, req.app.get('io'));
      return res.json({
        success: true,
        order: { reference: order.reference, isFreeOrder: true },
        message: 'Free order processed successfully.',
      });
    }

    if (!(order.totalAmount > 0)) {
      throw new AppError('Invalid order amount. Contact support.', 400);
    }

    const payment = await initializePayment({
      email: order.email,
      amount: order.totalAmount,
      reference: order.paymentReference,
      metadata: { orderReference: order.reference, packageId: order.package.toString() },
    });

    res.json({
      success: true,
      order: {
        reference: order.reference,
        paymentReference: order.paymentReference,
        totalAmount: order.totalAmount,
        packagePrice: order.packagePrice,
        paystackCharge: order.paystackCharge,
      },
      payment: {
        authorizationUrl: payment.authorization_url,
        accessCode: payment.access_code,
        publicKey: getPublicKey(),
      },
    });
  })
);

router.get(
  '/verify/:reference',
  noCache,
  paymentLimiter,
  validateParams(paymentReferenceSchema),
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ paymentReference: req.params.reference });
    if (!order) throw new AppError('Order not found.', 404);

    // Checker serial/PIN only when the requester proves ownership via matching email.
    const emailClaim = String(req.query.email || req.headers['x-order-email'] || '')
      .trim()
      .toLowerCase();
    const ownsOrder = Boolean(emailClaim && emailClaim === String(order.email || '').toLowerCase());
    const includeChecker = ownsOrder;

    if (order.paymentStatus === 'paid') {
      const updated = includeChecker
        ? await Order.findById(order._id).populate('checker', 'serialNumber pin checkerType')
        : order;
      return res.json({
        success: true,
        order: sanitizeOrder(updated, { includeChecker }),
        alreadyPaid: true,
      });
    }

    const payment = await verifyPayment(req.params.reference);

    if (payment.status !== 'success') {
      order.paymentStatus = 'failed';
      await order.save();
      throw new AppError('Payment verification failed.', 400);
    }

    if (payment.amount == null) {
      throw new AppError('Payment amount missing from provider response.', 400);
    }
    const amountPaid = payment.amount / 100;
    const result = await markOrderPaidFromPaystack({
      paymentReference: req.params.reference,
      paystackTransactionId: payment.id,
      amountPaid,
      io: req.app.get('io'),
    });

    const updated = includeChecker
      ? await Order.findById(result.order._id).populate('checker', 'serialNumber pin checkerType')
      : result.order;
    res.json({ success: true, order: sanitizeOrder(updated, { includeChecker }) });
  })
);

router.post(
  '/history/request-otp',
  otpLimiter,
  validateBody(otpRequestSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const emailResult = validateEmail(email);
    if (!emailResult.valid) throw new AppError(emailResult.error, 400);
    await createAndSendOTP(emailResult.normalized, 'order_history');
    res.json({ success: true, message: 'OTP sent to your email.' });
  })
);

router.post(
  '/history/verify',
  otpLimiter,
  validateBody(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const emailResult = validateEmail(email);
    if (!emailResult.valid) throw new AppError(emailResult.error, 400);
    await verifyOTP(emailResult.normalized, otp, 'order_history');

    const orders = await Order.find({ email: emailResult.normalized })
      .sort({ createdAt: -1 })
      .select('reference packageName phone packagePrice totalAmount deliveryStatus paymentStatus createdAt category serviceType')
      .lean();

    res.json({
      success: true,
      orders: orders.map((order) => sanitizeOrder(order, { includePhone: true })),
    });
  })
);

router.get(
  '/my-orders',
  protect,
  noCache,
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('checker', 'serialNumber pin checkerType')
      .lean();

    res.json({
      success: true,
      orders: orders.map((order) => sanitizeOrder(order, { includeChecker: order.paymentStatus === 'paid' })),
    });
  })
);

router.get(
  '/:reference',
  noCache,
  asyncHandler(async (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      throw new AppError('Email is required to look up this order.', 400);
    }

    const order = await Order.findOne({ reference: req.params.reference, email })
      .populate('checker', 'serialNumber pin checkerType')
      .lean();

    if (!order) throw new AppError('Order not found.', 404);

    res.json({
      success: true,
      order: sanitizeOrder(order, { includeChecker: order.paymentStatus === 'paid' }),
    });
  })
);

export default router;
