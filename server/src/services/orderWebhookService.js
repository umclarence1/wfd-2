import crypto from 'crypto';
import Checker from '../models/Checker.js';
import { env } from '../config/env.js';
import { getApiProviderSettings } from './apiProviderService.js';

const WEBHOOK_TIMEOUT_MS = 8000;

const getWebhookConfig = async () => {
  const settings = await getApiProviderSettings();
  const url = (settings.fulfillmentWebhookUrl || env.fulfillmentWebhookUrl || '').trim();
  const secret = (env.fulfillmentWebhookSecret || '').trim();
  return { url, secret, enabled: Boolean(url) };
};

export const buildOrderWebhookPayload = async (
  order,
  { event = 'order.status.updated', trigger = 'system', previousPaymentStatus, previousDeliveryStatus } = {}
) => {
  let checkers = [];
  if (
    order.serviceType === 'result_checker' &&
    order.paymentStatus === 'paid' &&
    order.deliveryStatus === 'delivered'
  ) {
    const ids =
      Array.isArray(order.checkers) && order.checkers.length
        ? order.checkers
        : order.checker
          ? [order.checker]
          : [];

    if (ids.length) {
      const docs = await Checker.find({ _id: { $in: ids } }).select(
        'checkerType serialNumber pin'
      );
      checkers = docs.map((checker) => ({
        checkerType: checker.checkerType,
        serialNumber: checker.serialNumber,
        pin: checker.pin,
      }));
    }
  }

  return {
    event,
    timestamp: new Date().toISOString(),
    trigger,
    order: {
      reference: order.reference,
      paymentReference: order.paymentReference || null,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      previousPaymentStatus: previousPaymentStatus ?? null,
      previousDeliveryStatus: previousDeliveryStatus ?? null,
      email: order.email,
      phone: order.phone,
      packageName: order.packageName,
      category: order.category,
      serviceType: order.serviceType,
      quantity: order.quantity ?? 1,
      packagePrice: order.packagePrice,
      totalAmount: order.totalAmount,
      promoCode: order.promoCode || null,
      providerReference: order.providerReference || null,
      providerId: order.providerId || null,
      failureReason: order.failureReason || null,
      isFreeOrder: Boolean(order.isFreeOrder),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      checkers,
    },
  };
};

export const sendOrderStatusWebhook = async (order, options = {}) => {
  const { url, secret, enabled } = await getWebhookConfig();
  if (!enabled) {
    return { sent: false, reason: 'no_webhook_url' };
  }

  const payload = await buildOrderWebhookPayload(order, options);
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'WilberforceDataService-Webhook/1.0',
    'X-WDS-Event': payload.event,
  };

  if (secret) {
    headers['X-WDS-Signature'] = crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[ORDER_WEBHOOK] Remote returned', response.status, detail.slice(0, 300));
      return { sent: false, reason: 'http_error', status: response.status };
    }

    console.log('[ORDER_WEBHOOK] Sent', {
      reference: order.reference,
      trigger: options.trigger || 'system',
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
    });

    return { sent: true, status: response.status };
  } catch (err) {
    console.error('[ORDER_WEBHOOK] Failed:', err.message);
    return {
      sent: false,
      reason: err.name === 'AbortError' ? 'timeout' : 'network_error',
      message: err.message,
    };
  }
};

/**
 * Emit Socket.IO update and POST order status to the configured webhook URL.
 */
export const publishOrderUpdate = async (order, options = {}) => {
  const {
    io,
    trigger = 'system',
    event = 'order.status.updated',
    previousPaymentStatus,
    previousDeliveryStatus,
    force = false,
  } = options;

  const paymentChanged =
    previousPaymentStatus !== undefined && previousPaymentStatus !== order.paymentStatus;
  const deliveryChanged =
    previousDeliveryStatus !== undefined && previousDeliveryStatus !== order.deliveryStatus;

  if (io) {
    io.emit('order:updated', {
      reference: order.reference,
      deliveryStatus: order.deliveryStatus,
      paymentStatus: order.paymentStatus,
    });
  }

  if (!force && !paymentChanged && !deliveryChanged) {
    return { sent: false, reason: 'unchanged' };
  }

  return sendOrderStatusWebhook(order, {
    event,
    trigger,
    previousPaymentStatus,
    previousDeliveryStatus,
  });
};

export const testOrderStatusWebhook = async () => {
  const { enabled } = await getWebhookConfig();
  if (!enabled) {
    return { sent: false, reason: 'no_webhook_url' };
  }

  const sampleOrder = {
    reference: 'ORD-TEST-WEBHOOK',
    paymentReference: 'PAY-TEST-WEBHOOK',
    paymentStatus: 'paid',
    deliveryStatus: 'delivered',
    email: 'customer@example.com',
    phone: '0595399837',
    packageName: 'MTN 1GB',
    category: 'MTN',
    serviceType: 'data_bundle',
    quantity: 1,
    packagePrice: 4.8,
    totalAmount: 4.9,
    promoCode: null,
    providerReference: 'TD-TEST-123',
    providerId: 'topdealsgh',
    failureReason: null,
    isFreeOrder: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return sendOrderStatusWebhook(sampleOrder, {
    event: 'order.status.test',
    trigger: 'admin.test',
    previousPaymentStatus: 'pending',
    previousDeliveryStatus: 'processing',
  });
};
