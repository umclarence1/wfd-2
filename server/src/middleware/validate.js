import { AppError } from './errorHandler.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issue = result.error.issues?.[0] || result.error.errors?.[0];
    const message = issue?.message || 'Invalid request data.';
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }
  req.body = result.data;
  return next();
};

export const validateParams = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const issue = result.error.issues?.[0] || result.error.errors?.[0];
    const message = issue?.message || 'Invalid request parameters.';
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }
  req.params = result.data;
  return next();
};
