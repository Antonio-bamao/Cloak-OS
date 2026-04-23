import { AppError } from './errors.js';

export function ok(data, message = '操作成功', pagination) {
  const response = {
    success: true,
    data,
    message
  };

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
}

export function fail(error) {
  const normalized = normalizeError(error);

  return {
    success: false,
    error: {
      code: normalized.errorCode,
      message: normalized.message
    }
  };
}

export function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError('Internal server error', 500, 'INTERNAL_ERROR');
}
