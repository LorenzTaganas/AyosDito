import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseBody<T extends ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T extends ZodTypeAny>(schema: T, query: unknown): z.infer<T> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    throw new ApiError(422, 'INVALID_QUERY', 'Some filters are invalid.', result.error.flatten());
  }
  return result.data;
}

export function parseId(value: string | string[] | undefined, label = 'ID'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    throw new ApiError(400, 'INVALID_ID', `Invalid ${label}.`);
  }
  return value;
}

export function notFound(message = 'The requested resource was not found.'): ApiError {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function forbidden(message = 'You do not have permission to do that.'): ApiError {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function unauthorized(message = 'Please sign in to continue.'): ApiError {
  return new ApiError(401, 'UNAUTHORIZED', message);
}
