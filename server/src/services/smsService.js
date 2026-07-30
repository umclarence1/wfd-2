import axios from 'axios';
import { env } from '../config/env.js';

const normalizeGhanaPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('233') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
};

export const sendSMS = async (phone, message) => {
  if (!env.arkesel.apiKey) {
    if (env.nodeEnv === 'production') {
      return { success: false, error: 'SMS provider is not configured.' };
    }
    console.log('[SMS] Mock send to', phone, `(${String(message || '').length} chars)`);
    return { success: true, mocked: true };
  }

  const normalized = normalizeGhanaPhone(phone);
  if (!normalized) {
    return { success: false, error: 'Invalid phone number.' };
  }

  try {
    const response = await axios.post(
      'https://sms.arkesel.com/api/v2/sms/send',
      {
        sender: env.arkesel.senderId,
        message,
        recipients: [normalized],
      },
      {
        headers: {
          'api-key': env.arkesel.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const data = response.data || {};
    const ok =
      data.status === 'success' ||
      data.success === true ||
      String(data.code || '') === 'ok' ||
      response.status === 200;

    if (!ok) {
      console.error('[SMS] Arkesel response:', data);
      return { success: false, mocked: false, ...data };
    }

    return { success: true, mocked: false, ...data };
  } catch (err) {
    console.error('[SMS] Arkesel send failed:', err.response?.data || err.message);
    return {
      success: false,
      mocked: false,
      error: err.response?.data?.message || err.message,
    };
  }
};

export const sendCheckerDeliverySMS = async (phone, { serialNumber, pin, checkers }) => {
  const list = Array.isArray(checkers) && checkers.length
    ? checkers
    : [{ serialNumber, pin }];

  const credentials = list
    .map((item) => `Serial: ${item.serialNumber}\nPIN: ${item.pin}`)
    .join('\n\n');

  const message = `${credentials}
Check your results using this link https://ghana.waecdirect.org/
Thank you for your purchase!`;

  return sendSMS(phone, message);
};

export const sendOrderConfirmationSMS = async (phone, order) => {
  const message = `Order ${order.reference} confirmed. ${order.packageName} - GH₵${order.totalAmount.toFixed(2)}. Status: ${order.deliveryStatus}. WDS`;
  return sendSMS(phone, message);
};

/** Short per-recipient SMS for MTN number verification wait. */
export const sendMtnVerificationSMS = async (phone, order) => {
  const number = order.phone || phone;
  const message = `MTN verification for ${number} is in progress. Takes 24-144 hrs. Ref ${order.reference}. WDS`;
  return sendSMS(phone, message);
};
