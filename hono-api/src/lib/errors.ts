export class DomainError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(opts: { message: string; statusCode: number; code: string; details?: unknown }) {
    super(opts.message);
    this.name = 'DomainError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found', details?: unknown) {
    super({ message, statusCode: 404, code: 'NOT_FOUND', details });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super({ message, statusCode: 409, code: 'CONFLICT', details });
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden', details?: unknown) {
    super({ message, statusCode: 403, code: 'FORBIDDEN', details });
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super({ message, statusCode: 401, code: 'UNAUTHORIZED', details });
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed', details?: unknown) {
    super({ message, statusCode: 422, code: 'VALIDATION_ERROR', details });
    this.name = 'ValidationError';
  }
}

export class DeadlinePassedError extends DomainError {
  constructor(message = 'Deadline passed', details?: unknown) {
    super({ message, statusCode: 409, code: 'DEADLINE_PASSED', details });
    this.name = 'DeadlinePassedError';
  }
}
