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
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = err.isOperational
    ? err.message
    : (isProd ? 'Something went wrong. Please try again.' : err.message || 'Something went wrong');

  if (!isProd) {
    console.error(err);
  } else if (!err.isOperational) {
    console.error('[ERROR]', err.message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code: err.code || 'INTERNAL_ERROR',
    ...(!isProd && { stack: err.stack }),
  });
};
