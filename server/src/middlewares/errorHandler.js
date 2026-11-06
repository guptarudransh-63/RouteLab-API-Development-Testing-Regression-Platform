import { ZodError } from 'zod';
import { SSRFSecurityError } from '../services/ssrfShield.js';
import { UnresolvedVariableError } from '../services/variableResolver.js';

export function errorHandler(err, req, res, next) {
  // SSRF Protection Error
  if (err instanceof SSRFSecurityError) {
    return res.status(403).json({
      success: false,
      error: err.message,
      code: 'SSRF_BLOCKED',
      details: err.details,
    });
  }

  // Missing Variables Error
  if (err instanceof UnresolvedVariableError) {
    return res.status(400).json({
      success: false,
      error: err.message,
      code: 'UNRESOLVED_VARIABLES',
      missingVariables: err.missingVariables,
    });
  }

  // Zod Input Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists`,
      code: 'DUPLICATE_ENTRY',
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', '),
      code: 'MONGOOSE_VALIDATION_ERROR',
    });
  }

  // Default / Internal Server Error
  console.error('[Unhandled Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: 'SERVER_ERROR',
  });
}
