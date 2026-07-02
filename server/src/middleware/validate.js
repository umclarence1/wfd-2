import { AppError } from './errorHandler.js';

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.errors[0]?.message || 'Invalid request data.';
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }
  req.body = result.data;
  return next();
};

export const validateParams = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const message = result.error.errors[0]?.message || 'Invalid request parameters.';
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }
  req.params = result.data;
  return next();
};
