import AuditLog from '../models/AuditLog.js';

const SECRET_KEY = /apiKey|apiSecret|secret|password|token|authorization/i;

export const redactSecrets = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) {
      out[key] = child ? '[redacted]' : child;
    } else if (child && typeof child === 'object') {
      out[key] = redactSecrets(child);
    } else {
      out[key] = child;
    }
  }
  return out;
};

export const logAudit = async ({ user, action, resource, resourceId, details, req }) => {
  try {
    await AuditLog.create({
      user: user?._id || user,
      action,
      resource,
      resourceId,
      details: redactSecrets(details),
      ipAddress: req?.ip,
      userAgent: req?.headers['user-agent'],
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

export const auditMiddleware = (action, resource) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      logAudit({
        user: req.user,
        action,
        resource,
        resourceId: req.params.id,
        details: req.body,
        req,
      });
    }
  });
  next();
};
