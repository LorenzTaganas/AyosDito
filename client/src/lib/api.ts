import type { ApiErrorBody, PageMeta } from '@shared/api-types';

const API_BASE = '/api';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    message: string,
    options: { status: number; code: string; details?: unknown; requestId?: string },
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export interface FieldErrors {
  [field: string]: string;
}

export function fieldErrorsFrom(error: unknown): FieldErrors | null {
  if (!isApiClientError(error) || !error.details || typeof error.details !== 'object') return null;
  const fieldErrors = (error.details as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
  if (!fieldErrors) return null;
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) result[field] = messages[0];
  }
  return Object.keys(result).length > 0 ? result : null;
}

type QueryValue = string | number | boolean | null | undefined;

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

let csrfFallback: string | null = null;

async function csrfToken(): Promise<string> {
  const cookieToken = readCookie('ayos_csrf');
  if (cookieToken) return cookieToken;
  if (csrfFallback) return csrfFallback;
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
  const payload = (await response.json()) as { data?: { token?: string } };
  const token = payload.data?.token;
  if (!response.ok || !token) {
    throw new ApiClientError('Your security token could not be loaded. Refresh the page and try again.', {
      status: response.status,
      code: 'CSRF_UNAVAILABLE',
    });
  }
  csrfFallback = token;
  return token;
}

async function parsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  formData?: FormData;
  retryCsrf?: boolean;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE}${path}${buildQuery(options.query)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isSafe = method === 'GET' || method === 'HEAD';
  if (!isSafe) headers['X-CSRF-Token'] = await csrfToken();

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
      mode: 'cors',
    });
  } catch {
    throw new ApiClientError(
      'The AyosDito server could not be reached. Check your connection and try again.',
      { status: 0, code: 'NETWORK_ERROR' },
    );
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | undefined;
    const error = errorBody?.error;
    if (
      response.status === 403 &&
      error?.code === 'CSRF_FAILED' &&
      !options.retryCsrf
    ) {
      csrfFallback = null;
      return request<T>(method, path, { ...options, retryCsrf: true });
    }
    throw new ApiClientError(error?.message ?? 'Something went wrong. Please try again.', {
      status: response.status,
      code: error?.code ?? 'REQUEST_FAILED',
      details: error?.details,
      requestId: error?.requestId,
    });
  }

  return (payload as { data: T } | undefined)?.data as T;
}

export interface ListResult<T> {
  data: T[];
  meta: PageMeta;
}

export const api = {
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return request<T>('GET', path, { query });
  },
  async list<T>(path: string, query?: Record<string, QueryValue>): Promise<ListResult<T>> {
    const url = `${API_BASE}${path}${buildQuery(query)}`;
    let response: Response;
    try {
      response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    } catch {
      throw new ApiClientError('The AyosDito server could not be reached. Check your connection and try again.', {
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }
    const payload = (await parsePayload(response)) as
      | { data: T[]; meta: PageMeta }
      | ApiErrorBody
      | undefined;
    if (!response.ok) {
      const error = (payload as ApiErrorBody | undefined)?.error;
      throw new ApiClientError(error?.message ?? 'Something went wrong. Please try again.', {
        status: response.status,
        code: error?.code ?? 'REQUEST_FAILED',
        details: error?.details,
        requestId: error?.requestId,
      });
    }
    const envelope = payload as { data: T[]; meta?: PageMeta };
    return {
      data: envelope.data,
      meta: envelope.meta ?? { page: 1, pageSize: envelope.data.length, total: envelope.data.length, totalPages: 1 },
    };
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, { body });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, { body });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, { body });
  },
  delete<T = void>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
  upload<T>(path: string, formData: FormData): Promise<T> {
    return request<T>('POST', path, { formData });
  },
};
