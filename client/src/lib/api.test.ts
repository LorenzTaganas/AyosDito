import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, api, fieldErrorsFrom, isApiClientError } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestInit(fetchMock: ReturnType<typeof vi.fn>, call = 0): RequestInit {
  return fetchMock.mock.calls[call][1] as RequestInit;
}

function requestHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, string> {
  return requestInit(fetchMock, call).headers as Record<string, string>;
}

beforeEach(() => {
  document.cookie = 'ayos_csrf=csrf-token-123; path=/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'ayos_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('api GET requests', () => {
  it('unwraps the data envelope and skips empty query values', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { status: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/health', { page: 2, q: 'wifi', blank: '' })).resolves.toEqual({ status: 'ok' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/health?page=2&q=wifi');
    expect(requestInit(fetchMock).method).toBe('GET');
    expect(requestInit(fetchMock).credentials).toBe('include');
    expect(requestHeaders(fetchMock)['X-CSRF-Token']).toBeUndefined();
  });
});

describe('api mutations and CSRF protection', () => {
  it('sends the CSRF cookie token and a JSON body on unsafe requests', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { id: 'req_1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/requests', { title: 'Laptop repair' });

    expect(requestInit(fetchMock).method).toBe('POST');
    expect(requestHeaders(fetchMock)['X-CSRF-Token']).toBe('csrf-token-123');
    expect(requestHeaders(fetchMock)['Content-Type']).toBe('application/json');
    expect(requestInit(fetchMock).body).toBe('{"title":"Laptop repair"}');
  });

  it('retries once when the server rejects a stale CSRF token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'CSRF_FAILED', message: 'Your security token expired.', requestId: 'r1' } },
          403,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.patch('/customer/profile', { city: 'Malolos' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestHeaders(fetchMock, 1)['X-CSRF-Token']).toBe('csrf-token-123');
  });

  it('does not retry forever when the refreshed token is also rejected', async () => {
    const rejected = () =>
      jsonResponse({ error: { code: 'CSRF_FAILED', message: 'Invalid token.' } }, 403);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(rejected()).mockResolvedValueOnce(rejected());
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.delete('/favorites/prov_1')).rejects.toMatchObject({ code: 'CSRF_FAILED', status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('api error handling', () => {
  it('maps API errors and field validation details', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Please check the highlighted fields.',
            requestId: 'req_42',
            details: { fieldErrors: { email: ['Enter a valid email address.'] } },
          },
        },
        422,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await api.post('/auth/register', {}).catch((caught: unknown) => caught);

    expect(isApiClientError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Please check the highlighted fields.',
      requestId: 'req_42',
    });
    expect(fieldErrorsFrom(error)).toEqual({ email: 'Enter a valid email address.' });
    expect(fieldErrorsFrom(new Error('not from the API'))).toBeNull();
  });

  it('reports an unreachable server as a network error', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/health')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});

describe('api.list', () => {
  it('returns data with the pagination envelope', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        data: [{ id: 'prov_1' }],
        meta: { page: 2, pageSize: 1, total: 5, totalPages: 5 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.list('/providers', { page: 2, pageSize: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/providers?page=2&pageSize=1');
    expect(result.data).toEqual([{ id: 'prov_1' }]);
    expect(result.meta).toEqual({ page: 2, pageSize: 1, total: 5, totalPages: 5 });
  });

  it('synthesizes meta when the server omits it', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [{ id: 1 }, { id: 2 }] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.list('/locations');

    expect(result.meta).toEqual({ page: 1, pageSize: 2, total: 2, totalPages: 1 });
  });
});
