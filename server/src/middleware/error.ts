import multer from 'multer';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../lib/http';
import { log } from '../lib/logger';

export const notFoundApi: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'This API endpoint does not exist.',
      requestId: res.locals.requestId,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const requestId = res.locals.requestId as string | undefined;

  if (error instanceof ApiError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details, requestId },
    });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'That image is too large. Please choose a file under the upload limit.'
        : 'The upload could not be processed.';
    return res.status(400).json({ error: { code: error.code, message, requestId } });
  }

  if (error && typeof error === 'object') {
    const err = error as { name?: string; code?: string; type?: string };
    if (err.name === 'PrismaClientKnownRequestError') {
      if (err.code === 'P2002') {
        return res.status(409).json({
          error: { code: 'CONFLICT', message: 'A record with those details already exists.', requestId },
        });
      }
      if (err.code === 'P2025') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'The requested record no longer exists.', requestId },
        });
      }
      if (err.code === 'P2003') {
        return res.status(400).json({
          error: { code: 'INVALID_REFERENCE', message: 'That record is still in use or does not exist.', requestId },
        });
      }
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.', requestId },
      });
    }
  }

  log('error', 'Unhandled request error', {
    requestId,
    method: req.method,
    path: req.path,
    error: error instanceof Error ? error.message : 'unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      requestId,
    },
  });
};
