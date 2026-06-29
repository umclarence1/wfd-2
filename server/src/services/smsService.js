import axios from 'axios';
import { env } from '../config/env.js';

export const sendSMS = async (phone, message) => {
  if (!env.mnotify.apiKey) {
    console.log('[SMS]', phone, message);
    return { success: true, mocked: true };
  }

  const normalized = phone.startsWith('0') ? `233${phone.slice(1)}` : phone;

  const response = await axios.post(
    'https://api.mnotify.com/api/sms/quick',
    {
      recipient: [normalized],
      sender: env.mnotify.senderId,
      message,
      is_schedule: false,
    },
    {
      params: { key: env.mnotify.apiKey },
      timeout: 15000,
    }
  );

  return response.data;
};

export const sendCheckerDeliverySMS = async (phone, { checkerType, serialNumber, pin, orderReference, supportContact }) => {
  const message = `${checkerType} Checker\nRef: ${orderReference}\nSerial: ${serialNumber}\nPIN: ${pin}\nSupport: ${supportContact}`;
  return sendSMS(phone, message);
};

export const sendOrderConfirmationSMS = async (phone, order) => {
  const message = `Order ${order.reference} confirmed. ${order.packageName} - GH₵${order.totalAmount.toFixed(2)}. Status: ${order.deliveryStatus}. WDS`;
  return sendSMS(phone, message);
};
