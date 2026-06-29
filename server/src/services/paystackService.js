import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env.js';

const paystackApi = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${env.paystack.secretKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export const initializePayment = async ({ email, amount, reference, metadata }) => {
  if (!env.paystack.secretKey) {
    return {
      authorization_url: `${env.clientUrl}/payment/callback?reference=${reference}&mock=true`,
      access_code: 'mock_access_code',
      reference,
      mocked: true,
    };
  }

  const { data } = await paystackApi.post('/transaction/initialize', {
    email,
    amount: Math.round(amount * 100),
    reference,
    callback_url: `${env.clientUrl}/payment/callback`,
    metadata,
  });

  return data.data;
};

export const verifyPayment = async (reference) => {
  if (!env.paystack.secretKey) {
    return {
      status: 'success',
      reference,
      amount: 0,
      mocked: true,
    };
  }

  const { data } = await paystackApi.get(`/transaction/verify/${reference}`);
  return data.data;
};

export const verifyWebhookSignature = (req) => {
  if (!env.paystack.secretKey) return true;

  const hash = crypto
    .createHmac('sha512', env.paystack.secretKey)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return hash === req.headers['x-paystack-signature'];
};

export const calculatePaystackCharge = (packagePrice) => {
  return Math.round(packagePrice * env.paystackChargeRate * 100) / 100;
};

export const calculateTotal = (packagePrice) => {
  const charge = calculatePaystackCharge(packagePrice);
  return {
    packagePrice,
    paystackCharge: charge,
    totalAmount: Math.round((packagePrice + charge) * 100) / 100,
  };
};

export const getPublicKey = () => env.paystack.publicKey;
