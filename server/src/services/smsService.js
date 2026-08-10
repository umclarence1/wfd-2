import { env } from '../config/env.js';

export const sendSMS = async (phone, message) => {
  if (!env.arkesel.apiKey) {
    if (env.nodeEnv === 'production') {
      return { success: false, error: 'SMS provider is not configured.' };
    }
    console.log('[SMS] Mock send to', phone, `(${String(message || '').length} chars)`);
    return { success: true, mocked: true };
  }

  const normalized = String(phone || '').replace(/\D/g, '');
  if (!/^0?233\d{9}$|^0\d{9}$/.test(normalized)) {
    return { success: false, error: 'Invalid phone number for SMS.' };
  }

  const to = normalized.startsWith('233') ? normalized : `233${normalized.replace(/^0/, '')}`;

  try {
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.arkesel.apiKey,
      },
      body: JSON.stringify({
        sender: env.arkesel.senderId,
        message: String(message || '').slice(0, 160),
        recipients: [to],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') {
      console.error('[SMS] Arkesel response:', data);
      return { success: false, error: data.message || 'SMS send failed.' };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[SMS] Arkesel send failed:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
};

/** Send result checker serial/PIN to the beneficiary phone. */
export const sendCheckerDeliverySMS = async (phone, { serialNumber, pin, checkers }) => {
  const list = Array.isArray(checkers) && checkers.length
    ? checkers
    : [{ serialNumber, pin }];

  const lines = list
    .map((item, index) => {
      const prefix = list.length > 1 ? `#${index + 1} ` : '';
      return `${prefix}Serial: ${item.serialNumber} PIN: ${item.pin}`;
    })
    .join(' | ');

  const message = `WAEC Result Checker — ${lines}. Check results: ghana.waecdirect.org`;
  return sendSMS(phone, message);
};
