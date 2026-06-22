import {
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonObject,
  NodeApiError,
} from 'n8n-workflow';

// Token cache per-process (per baseUrl+clientId). inSign tokens are ~30min.
// Keyed so different credentials / tenants don't collide.
interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

async function getAccessToken(
  this: IExecuteFunctions,
  baseUrl: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const key = `${baseUrl}::${clientId}`;
  const cached = tokenCache.get(key);
  if (cached && Date.now() < cached.expiresAt - 30_000) return cached.token;

  const res = (await this.helpers.httpRequest({
    method: 'POST',
    url: `${baseUrl}/oauth2/token`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })) as { access_token?: string; expires_in?: number };

  if (!res?.access_token) {
    throw new Error('inSign /oauth2/token did not return an access_token');
  }
  tokenCache.set(key, {
    token: res.access_token,
    expiresAt: Date.now() + (res.expires_in ?? 1800) * 1000,
  });
  return res.access_token;
}

export interface RequestExtras {
  timeout?: number;
  traceId?: string;
}

export async function insignRequest(
  this: IExecuteFunctions,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  encoding?: 'arraybuffer' | 'json',
  extras?: RequestExtras,
): Promise<{ data: any; meta: RequestMeta }> {
  const credentials = await this.getCredentials('insignApi');
  const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
  const clientId = credentials.clientId as string;
  const clientSecret = credentials.clientSecret as string;
  const traceId = extras?.traceId || `n8n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // Fetch-and-cache the OAuth2 token ourselves. n8n's preAuthentication hook
  // only fires reliably for the credential-test flow; for actual node runs we
  // can't rely on it, so we mint (or reuse) a Bearer token explicitly here.
  const token = await getAccessToken.call(this, baseUrl, clientId, clientSecret);

  const options: IHttpRequestOptions = {
    method,
    url: `${baseUrl}${path}`,
    json: encoding !== 'arraybuffer',
    body: body as unknown as IHttpRequestOptions['body'],
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': traceId,
      Authorization: `Bearer ${token}`,
    },
    timeout: extras?.timeout ?? 30000,
  };

  if (encoding === 'arraybuffer') {
    options.encoding = 'arraybuffer';
    options.returnFullResponse = true;
  }

  const started = Date.now();
  this.logger.debug(`[inSign] ${method} ${path} trace=${traceId}`, { body: redactBody(body) });

  let data: any;
  try {
    data = await this.helpers.httpRequest(options);
  } catch (error) {
    // If inSign rejected the token (maybe cached token expired), invalidate
    // and retry once with a fresh one.
    if ((error as any)?.response?.status === 401) {
      tokenCache.delete(`${baseUrl}::${clientId}`);
      const fresh = await getAccessToken.call(this, baseUrl, clientId, clientSecret);
      options.headers!.Authorization = `Bearer ${fresh}`;
      try {
        data = await this.helpers.httpRequest(options);
      } catch (retryError) {
        error = retryError;
      }
    }
    if (!data) {
      const durationMs = Date.now() - started;
      const bodySnippet = extractErrorBody(error);
      this.logger.warn(
        `[inSign] ${method} ${path} HTTP failure trace=${traceId} (${durationMs}ms): ${(error as Error).message}${
          bodySnippet ? ` — body: ${bodySnippet}` : ''
        }`,
      );
      throw new NodeApiError(this.getNode(), error as JsonObject, {
        message: `inSign ${method} ${path} failed`,
        description: `Trace ID: ${traceId}.${bodySnippet ? ` inSign said: ${bodySnippet}` : ''} ${
          (error as Error).message
        }`.trim(),
      });
    }
  }

  const durationMs = Date.now() - started;

  // inSign returns HTTP 200 with {error: <non-zero>, message: "..."} on
  // many semantic failures (e.g. unknown sessionid). Surface these as
  // real errors instead of silently returning them as success.
  if (encoding !== 'arraybuffer' && isInsignErrorBody(data)) {
    const errCode = data.error;
    const msg = data.message || `inSign returned error=${errCode}`;
    this.logger.warn(
      `[inSign] ${method} ${path} logical error=${errCode} trace=${traceId} (${durationMs}ms): ${msg}`,
    );
    throw new NodeApiError(this.getNode(), data as JsonObject, {
      message: `inSign ${method} ${path} → error=${errCode}`,
      description: `${msg} (trace: ${traceId})`,
      httpCode: String(errCode),
    });
  }

  this.logger.debug(`[inSign] ${method} ${path} ok trace=${traceId} (${durationMs}ms)`);
  return { data, meta: { method, path, durationMs, traceId, url: `${baseUrl}${path}` } };
}

export function isInsignErrorBody(body: unknown): body is { error: unknown; message?: string } {
  if (!body || typeof body !== 'object') return false;
  const rec = body as Record<string, unknown>;
  if (!('error' in rec)) return false;
  const v = rec.error;
  // zero / false / null / undefined = success
  if (v === 0 || v === false || v == null) return false;
  // "0" treated as success too (defensive)
  if (typeof v === 'string' && (v === '0' || v === '')) return false;
  return true;
}

function extractErrorBody(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const err = error as Record<string, any>;
  // n8n's httpRequest error shape: response.body / response.data / cause
  const candidates = [err?.response?.body, err?.response?.data, err?.body, err?.cause?.response?.body];
  for (const c of candidates) {
    if (c != null) {
      const str = typeof c === 'string' ? c : JSON.stringify(c);
      return str.slice(0, 500);
    }
  }
  return '';
}

export interface RequestMeta {
  method: string;
  path: string;
  durationMs: number;
  traceId: string;
  url: string;
}

function redactBody(body: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!body) return body;
  const clone: Record<string, unknown> = { ...body };
  if (Array.isArray(clone.documents)) {
    clone.documents = (clone.documents as Array<Record<string, unknown>>).map((d) =>
      d?.file ? { ...d, file: `<base64:${String(d.file).length} chars>` } : d,
    );
  }
  return clone;
}

export function mergeAdditionalFields(base: Record<string, unknown>, extra?: string | object): Record<string, unknown> {
  if (!extra) return base;
  let parsed: object;
  if (typeof extra === 'string') {
    const trimmed = extra.trim();
    if (!trimmed) return base;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      throw new Error(`Additional Fields is not valid JSON: ${(e as Error).message}`);
    }
  } else {
    parsed = extra;
  }
  return { ...base, ...parsed };
}
