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
import { createPendingPayment } from '../services/pendingPaymentService.js';
import { initializePayment, getPublicKey, verifyPayment } from '../services/paystackService.js';
import { markOrderPaidFromPaystack } from '../services/paymentProcessingService.js';
import { publishOrderUpdate } from '../services/orderWebhookService.js';
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

    if (validated.pricing.isFreeOrder === true) {
      const order = await createOrder(validated, req.user, idempotencyKey);
      await publishOrderUpdate(order, {
        io: req.app.get('io'),
        trigger: 'order.created',
        event: 'order.created',
        force: true,
      });
      await processFreeOrder(order, validated.promoResult, req.user, req.app.get('io'));
      return res.json({
        success: true,
        order: { reference: order.reference, isFreeOrder: true },
        message: 'Free order processed successfully.',
      });
    }

    const checkout = await createPendingPayment(validated, req.user, idempotencyKey);
    if (checkout.kind === 'order') {
      const order = checkout.doc;
      if (order.paymentStatus === 'paid') {
        return res.json({
          success: true,
          order: {
            reference: order.reference,
            paymentReference: order.paymentReference,
            totalAmount: order.totalAmount,
            alreadyPaid: true,
          },
          message: 'Order already paid.',
        });
      }
      throw new AppError('Duplicate checkout request. Complete payment or try again.', 409);
    }

    const pending = checkout.doc;

    if (!(pending.totalAmount > 0)) {
      throw new AppError('Invalid order amount. Contact support.', 400);
    }

    const payment = await initializePayment({
      email: pending.email,
      amount: pending.totalAmount,
      reference: pending.paymentReference,
      metadata: {
        packageId: pending.package.toString(),
        phone: pending.phone,
        category: pending.category,
      },
    });

    res.json({
      success: true,
      checkout: {
        paymentReference: pending.paymentReference,
        totalAmount: pending.totalAmount,
        packagePrice: pending.packagePrice,
        paystackCharge: pending.paystackCharge,
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
    const paymentRef = req.params.reference;
    const order = await Order.findOne({ paymentReference: paymentRef });

    const emailClaim = String(req.query.email || req.headers['x-order-email'] || '')
      .trim()
      .toLowerCase();
    const ownsOrder = Boolean(
      order && emailClaim && emailClaim === String(order.email || '').toLowerCase()
    );
    const includeChecker = ownsOrder;

    if (order?.paymentStatus === 'paid') {
      const updated = includeChecker
        ? await Order.findById(order._id)
            .populate('checker', 'serialNumber pin checkerType')
            .populate('checkers', 'serialNumber pin checkerType')
        : order;
      return res.json({
        success: true,
        order: sanitizeOrder(updated, { includeChecker }),
        alreadyPaid: true,
      });
    }

    const payment = await verifyPayment(paymentRef);

    if (payment.status !== 'success') {
      throw new AppError('Payment not completed. No order was created.', 400);
    }

    if (payment.amount == null) {
      throw new AppError('Payment amount missing from provider response.', 400);
    }
    const amountPaid = payment.amount / 100;
    const result = await markOrderPaidFromPaystack({
      paymentReference: paymentRef,
      paystackTransactionId: payment.id,
      amountPaid,
      io: req.app.get('io'),
    });

    const updated = includeChecker
      ? await Order.findById(result.order._id)
          .populate('checker', 'serialNumber pin checkerType')
          .populate('checkers', 'serialNumber pin checkerType')
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
      .select(
        'reference packageName phone packagePrice totalAmount deliveryStatus paymentStatus createdAt category serviceType checker checkers'
      )
      .populate('checker', 'serialNumber pin checkerType')
      .populate('checkers', 'serialNumber pin checkerType')
      .lean();

    res.json({
      success: true,
      orders: orders.map((order) =>
        sanitizeOrder(order, {
          includePhone: true,
          includeChecker: order.paymentStatus === 'paid',
        })
      ),
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
      .populate('checkers', 'serialNumber pin checkerType')
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
      .populate('checkers', 'serialNumber pin checkerType')
      .lean();

    if (!order) throw new AppError('Order not found.', 404);

    res.json({
      success: true,
      order: sanitizeOrder(order, { includeChecker: order.paymentStatus === 'paid' }),
    });
  })
);

export default router;
