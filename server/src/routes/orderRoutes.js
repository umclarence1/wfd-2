import { Router } from 'express';
import Order from '../models/Order.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { optionalAuth, protect, noCache } from '../middleware/auth.js';
import { paymentLimiter, otpLimiter } from '../middleware/rateLimit.js';
import {
  validateOrderInput,
  createOrder,
  fulfillOrder,
  processFreeOrder,
  getPaymentBreakdown,
} from '../services/orderService.js';
import { initializePayment, verifyPayment, getPublicKey } from '../services/paystackService.js';
import { createAndSendOTP, verifyOTP } from '../services/authService.js';
import { validateEmail } from '../utils/validation.js';
import { redeemPromoCode } from '../services/promoService.js';

const router = Router();

router.post(
  '/validate',
  noCache,
  optionalAuth,
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
  asyncHandler(async (req, res) => {
    const validated = await validateOrderInput(req.body, req.user);
    const order = await createOrder({ ...validated, afaDetails: req.body.afaDetails }, req.user);

    if (validated.pricing.isFreeOrder || validated.totalAmount === 0) {
      await processFreeOrder(order, validated.promoResult, req.user, req.app.get('io'));
      return res.json({
        success: true,
        order: { reference: order.reference, isFreeOrder: true },
        message: 'Free order processed successfully.',
      });
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
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ paymentReference: req.params.reference });
    if (!order) throw new AppError('Order not found.', 404);

    if (order.paymentStatus === 'paid') {
      return res.json({ success: true, order, alreadyPaid: true });
    }

    const payment = await verifyPayment(req.params.reference);

    if (payment.status !== 'success') {
      order.paymentStatus = 'failed';
      await order.save();
      throw new AppError('Payment verification failed.', 400);
    }

    order.paymentStatus = 'paid';
    order.paystackTransactionId = payment.id?.toString();
    await order.save();

    if (order.promoCode) {
      const PromoCode = (await import('../models/PromoCode.js')).default;
      const promo = await PromoCode.findOne({ code: order.promoCode });
      if (promo) {
        await redeemPromoCode({
          promo,
          email: order.email,
          phone: order.phone,
          userId: order.user,
          orderId: order._id,
        });
      }
    }

    await fulfillOrder(order._id, req.app.get('io'));

    const updated = await Order.findById(order._id).populate('checker', 'serialNumber pin checkerType');
    res.json({ success: true, order: updated });
  })
);

router.post(
  '/history/request-otp',
  otpLimiter,
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
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const emailResult = validateEmail(email);
    if (!emailResult.valid) throw new AppError(emailResult.error, 400);
    await verifyOTP(emailResult.normalized, otp, 'order_history');

    const orders = await Order.find({ email: emailResult.normalized })
      .sort({ createdAt: -1 })
      .select('reference packageName phone packagePrice totalAmount deliveryStatus paymentStatus createdAt')
      .lean();

    res.json({ success: true, orders });
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
    res.json({ success: true, orders });
  })
);

router.get(
  '/:reference',
  noCache,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ reference: req.params.reference })
      .populate('checker', 'serialNumber pin checkerType')
      .lean();
    if (!order) throw new AppError('Order not found.', 404);
    res.json({ success: true, order });
  })
);

export default router;
