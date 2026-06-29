import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.smtp.host || !env.smtp.user) {
    console.warn('SMTP not configured. Emails will be logged to console.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter();
  const mailOptions = {
    from: env.smtp.from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
  };

  if (!transport) {
    console.log('[EMAIL]', { to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html });
    return { success: true, mocked: true };
  }

  try {
    await transport.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error('[EMAIL] Delivery failed:', err.message);
    console.log('[EMAIL] Fallback log:', { to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html });
    return { success: false, error: err.message };
  }
};

export const sendOTPEmail = async (email, otp) => {
  return sendEmail({
    to: email,
    subject: 'Your Verification Code - Wilberforce Data Service',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verification Code</h2>
        <p>Your OTP code is:</p>
        <h1 style="letter-spacing: 8px; color: #2563eb;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

export const sendAdminLoginOTPEmail = async (email, otp) => {
  return sendEmail({
    to: email,
    subject: 'Admin Login Code - Wilberforce Data Service',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Admin sign-in verification</h2>
        <p>Someone is signing in to the admin dashboard. Use this code to complete login:</p>
        <h1 style="letter-spacing: 8px; color: #2563eb;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not try to sign in, change your admin password immediately.</p>
      </div>
    `,
  });
};

export const sendCheckerDeliveryEmail = async (email, { checkerType, serialNumber, pin, orderReference, supportContact }) => {
  return sendEmail({
    to: email,
    subject: `Your ${checkerType} Result Checker - ${orderReference}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${checkerType} Result Checker</h2>
        <p><strong>Order Reference:</strong> ${orderReference}</p>
        <p><strong>Serial Number:</strong> ${serialNumber}</p>
        <p><strong>PIN:</strong> ${pin}</p>
        <p>For support, contact: ${supportContact}</p>
      </div>
    `,
  });
};

export const sendOrderConfirmationEmail = async (email, order) => {
  return sendEmail({
    to: email,
    subject: `Order Confirmation - ${order.reference}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Confirmed</h2>
        <p><strong>Reference:</strong> ${order.reference}</p>
        <p><strong>Product:</strong> ${order.packageName}</p>
        <p><strong>Amount:</strong> GH₵${order.totalAmount.toFixed(2)}</p>
        <p><strong>Status:</strong> ${order.deliveryStatus}</p>
      </div>
    `,
  });
};
