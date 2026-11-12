/**
 * A thin fetch wrapper over `/api/v1`. It never throws on an HTTP status:
 * callers decide what a 4xx means. Every 5xx is recorded, because a server
 * error is a defect whatever the scenario expected.
 */

export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly body: T;
}

export interface ServerError {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly body: unknown;
}

export class HttpError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`${method} ${path} answered ${status}: ${JSON.stringify(body)}`);
  }

  /** The `{ error: { code } }` code, when the body has one. */
  get code(): string | undefined {
    const error = (this.body as { error?: { code?: unknown } } | null)?.error;
    return typeof error?.code === 'string' ? error.code : undefined;
  }
}

export interface RequestOptions {
  readonly token?: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export class Http {
  readonly serverErrors: ServerError[] = [];
  requestCount = 0;

  /** `baseUrl` is the origin, such as `http://localhost:3000`. */
  constructor(readonly baseUrl: string) {}

  async request<T = unknown>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    this.requestCount++;
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (res.status >= 500) this.serverErrors.push({ method, path, status: res.status, body });
    return { status: res.status, body: body as T };
  }

  /** Like `request`, but a status outside 2xx throws an `HttpError`. */
  async ok<T = unknown>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.request<T>(method, path, options);
    if (res.status < 200 || res.status >= 300) throw new HttpError(method, path, res.status, res.body);
    return res.body;
  }
}
