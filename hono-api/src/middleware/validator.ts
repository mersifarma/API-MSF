import { zValidator } from '@hono/zod-validator';
import type { ZodType } from 'zod';
import { ValidationError } from '../lib/errors';

export function validateJson<T extends ZodType>(schema: T) {
  return zValidator('json', schema, (result) => {
    if (!result.success) {
      throw new ValidationError('Invalid request body', {
        issues: result.error.issues,
      });
    }
  });
}

export function validateParams<T extends ZodType>(schema: T) {
  return zValidator('param', schema, (result) => {
    if (!result.success) {
      throw new ValidationError('Invalid URL params', {
        issues: result.error.issues,
      });
    }
  });
}

export function validateQuery<T extends ZodType>(schema: T) {
  return zValidator('query', schema, (result) => {
    if (!result.success) {
      throw new ValidationError('Invalid query params', {
        issues: result.error.issues,
      });
    }
  });
}
