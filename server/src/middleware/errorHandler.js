export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let isOperational = Boolean(err.isOperational);
  let message = err.message || 'Something went wrong';

  // Surface mongoose validation / cast errors instead of a generic 500.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    isOperational = true;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .filter(Boolean)
      .join(' ') || 'Invalid data.';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    isOperational = true;
    message = 'Invalid id or field value.';
  }

  const isProd = process.env.NODE_ENV === 'production';
  const safeMessage = isOperational
    ? message
    : (isProd ? 'Something went wrong. Please try again.' : message);

  if (!isProd) {
    console.error(err);
  } else if (!isOperational) {
    console.error('[ERROR]', err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    code,
    ...(!isProd && { stack: err.stack }),
  });
};
