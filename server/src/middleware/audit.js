import AuditLog from '../models/AuditLog.js';

export const logAudit = async ({ user, action, resource, resourceId, details, req }) => {
  try {
    await AuditLog.create({
      user: user?._id || user,
      action,
      resource,
      resourceId,
      details,
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
