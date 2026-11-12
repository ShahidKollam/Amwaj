import { ZodError } from 'zod';
import { config } from '../config/index.js';

export function errorHandler(err, req, res, next) {
  // Validation errors → 400 with clear message (no stack)
  if (err instanceof ZodError) {
    const first = err.errors?.[0];
    const message = first
      ? `${first.path?.join('.') || 'input'}: ${first.message}`
      : 'Validation failed';
    return res.status(400).json({ error: message });
  }

  // App-assigned status (e.g. business rule errors)
  const status = err.status || err.statusCode || 500;
  const isProd = config.nodeEnv === 'production';

  if (status >= 500) {
    console.error(err);
  } else if (!isProd) {
    console.warn(err.message || err);
  }

  // Never leak internal details or stack traces in production
  const message =
    status >= 500 && isProd
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(!isProd && status >= 500 && err.stack ? { stack: err.stack } : {}),
  });
}
