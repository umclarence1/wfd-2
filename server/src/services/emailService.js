import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getFromAddress = () => {
  const smtpUser = env.smtp.user?.trim();
  if (!smtpUser) return env.smtp.from;

  const configured = env.smtp.from || '';
  const nameMatch = configured.match(/^(.+?)\s*<[^>]+>$/);
  const displayName = nameMatch?.[1]?.trim() || 'Wilberforce Data Service';
  return `${displayName} <${smtpUser}>`;
};

const buildTransporter = (port = env.smtp.port) =>
  nodemailer.createTransport({
    host: env.smtp.host || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });

const getTransporter = () => {
  if (transporter) return transporter;
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    console.warn('SMTP not configured. Emails will use fallback providers.');
    return null;
  }
  transporter = buildTransporter();
  return transporter;
};

const sendViaResend = async ({ to, subject, html }) => {
  if (!env.resendApiKey) return { success: false, skipped: true };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [to],
        subject,
        html,
        reply_to: 'wilberforceboanu2002@gmail.com',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: body || `Resend HTTP ${response.status}` };
    }

    return { success: true, provider: 'resend' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const sendViaSmtp = async (mailOptions) => {
  const transport = getTransporter();
  if (!transport) return { success: false, skipped: true };

  try {
    await transport.sendMail(mailOptions);
    return { success: true, provider: 'smtp' };
  } catch (err) {
    if (env.smtp.port === 465) {
      try {
        await buildTransporter(587).sendMail(mailOptions);
        transporter = buildTransporter(587);
        return { success: true, provider: 'smtp-587' };
      } catch (retryErr) {
        return { success: false, error: retryErr.message };
      }
    }
    return { success: false, error: err.message };
  }
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: getFromAddress(),
    replyTo: 'wilberforceboanu2002@gmail.com',
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
  };

  const resendResult = await sendViaResend(mailOptions);
  if (resendResult.success) return resendResult;

  const smtpResult = await sendViaSmtp(mailOptions);
  if (smtpResult.success) return smtpResult;

  if (env.nodeEnv !== 'production') {
    console.log('[EMAIL] Dev fallback:', { to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html });
    return { success: true, mocked: true };
  }

  console.error('[EMAIL] Delivery failed:', smtpResult.error || resendResult.error || 'No provider configured');
  return {
    success: false,
    error: smtpResult.error || resendResult.error || 'Email delivery failed',
  };
};

const EMAIL_HEADER = `
  <div style="text-align:center;margin-bottom:24px;">
    <p style="margin:0;font-size:22px;font-weight:700;color:#1d4ed8;">Wilberforce Data Service</p>
    <p style="margin:6px 0 0;font-size:13px;color:#64748b;">wilberforceboanu2002@gmail.com</p>
  </div>
`;

export const sendOTPEmail = async (email, otp) => {
  return sendEmail({
    to: email,
    subject: 'Your Verification Code - Wilberforce Data Service',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        ${EMAIL_HEADER}
        <h2 style="color:#0f172a;">Verification Code</h2>
        <p>Your one-time code is:</p>
        <h1 style="letter-spacing: 10px; color: #2563eb; font-size: 36px; text-align: center;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p style="color:#64748b;font-size:13px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

export const sendAdminLoginOTPEmail = async (email, otp) => {
  return sendEmail({
    to: email,
    subject: 'Admin Login Code - Wilberforce Data Service',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        ${EMAIL_HEADER}
        <h2 style="color:#0f172a;">Admin sign-in verification</h2>
        <p>Someone is signing in to the Wilberforce Data Service admin dashboard. Use this code to complete login:</p>
        <h1 style="letter-spacing: 10px; color: #2563eb; font-size: 36px; text-align: center;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p style="color:#64748b;font-size:13px;">If you did not try to sign in, change your admin password immediately.</p>
      </div>
    `,
  });
};

export const sendCheckerDeliveryEmail = async (
  email,
  { checkerType, serialNumber, pin, checkers, orderReference }
) => {
  const list = Array.isArray(checkers) && checkers.length
    ? checkers
    : [{ serialNumber, pin }];

  const blocks = list
    .map(
      (item) => `
        <p style="margin:0 0 4px;font-size:16px;"><strong>Serial:</strong> ${item.serialNumber}</p>
        <p style="margin:0 0 16px;font-size:16px;"><strong>PIN:</strong> ${item.pin}</p>`
    )
    .join('');

  return sendEmail({
    to: email,
    subject: `Your ${checkerType || 'WAEC'} Result Checker${list.length > 1 ? `s (${list.length})` : ''}${orderReference ? ` - ${orderReference}` : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
        ${EMAIL_HEADER}
        ${blocks}
        <p style="margin:16px 0;font-size:15px;">
          Check your results using this link
          <a href="https://ghana.waecdirect.org/" style="color:#059669;font-weight:700;">https://ghana.waecdirect.org/</a>
        </p>
        <p style="margin:16px 0 0;font-size:15px;">Thank you for your purchase!</p>
      </div>
    `,
  });
};

export const sendOrderConfirmationEmail = async (email, order) => {
  const amount =
    order.totalAmount != null && !Number.isNaN(Number(order.totalAmount))
      ? `GH₵${Number(order.totalAmount).toFixed(2)}`
      : '—';
  const paystackRef = order.paymentReference || '—';

  return sendEmail({
    to: email,
    subject: `Order Confirmation - ${order.reference}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Confirmed</h2>
        <p><strong>Reference:</strong> ${order.reference}</p>
        <p><strong>Paystack reference:</strong> ${paystackRef}</p>
        <p><strong>Phone:</strong> ${order.phone || '—'}</p>
        <p><strong>Product:</strong> ${order.packageName || '—'}</p>
        <p><strong>Amount:</strong> ${amount}</p>
      </div>
    `,
  });
};

/** Sent when an order moves into network number verification (e.g. Telecel/MTN via TopDealsGH). */
export const sendNumberVerificationEmail = async (email, order) => {
  const network = String(order.category || 'Network').replace(/\s+AFA$/i, '').trim() || 'Network';
  const phone = order.phone || 'your number';
  const reference = order.reference || order.providerReference || '—';

  return sendEmail({
    to: email,
    subject: `${network} number verification in progress — Wilberforce Data Service`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
        ${EMAIL_HEADER}
        <h2 style="margin:0 0 16px;color:#7c6bb5;">${network} number verification</h2>
        <p style="font-size:15px;line-height:1.6;">
          This number (<strong>${phone}</strong>) is not verified on our system, so it has been submitted to ${network} for verification.
        </p>
        <p style="font-size:15px;line-height:1.6;">
          Verification will take <strong style="color:#e11d48;">24–144 hours</strong>. After verification, subsequent orders for this number will come fast.
        </p>
        <p style="font-size:15px;line-height:1.6;">
          During this verification period, kindly have patience — your money is safe and your order is already processed in the system.
        </p>
        <p style="font-size:15px;line-height:1.6;">
          Order reference: <strong>${reference}</strong>
        </p>
        <p style="margin-top:24px;font-size:15px;line-height:1.6;">
          Thank you.<br/>
          Best regards,<br/>
          <strong>Wilberforce Data Service Team</strong>
        </p>
      </div>
    `,
  });
};
