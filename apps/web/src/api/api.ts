import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { API_BASE_PATH, errorBodySchema, healthResponseSchema, type ErrorCode, type HealthResponse } from '@warewolf/contracts';
import type { z } from 'zod';
import { cleared, selectToken, type SessionState } from '../session/sessionSlice';

/**
 * Where requests go and how they are sent. Passed to the store as the thunk
 * extra argument so tests can supply a fake fetch, and the Android build can
 * point at a configured API origin (WW-1602).
 */
export interface ApiEnvironment {
  /** Absolute or same-origin base, ending in /api/v1. */
  readonly baseUrl: string;
  readonly fetchFn?: typeof fetch;
}

/** Same origin by default. `VITE_API_ORIGIN` overrides it, for example in the APK. */
export function defaultApiEnvironment(): ApiEnvironment {
  const origin = import.meta.env.VITE_API_ORIGIN ?? '';
  return { baseUrl: `${origin}${API_BASE_PATH}` };
}

/** What screens show for a failed request. */
export interface ApiErrorInfo {
  readonly status: number | 'NETWORK' | 'PARSE';
  readonly code: ErrorCode | 'NETWORK_ERROR' | 'BAD_RESPONSE';
  readonly message: string;
  readonly issues: readonly { path: string; message: string }[];
}

/** Normalizes any RTK Query error into `ApiErrorInfo`. Returns null when there is no error. */
export function apiErrorOf(error: unknown): ApiErrorInfo | null {
  if (!error) return null;
  const e = error as { status?: unknown; data?: unknown };
  if (typeof e.status === 'number') {
    const body = errorBodySchema.safeParse(e.data);
    if (body.success) {
      return { status: e.status, code: body.data.error.code, message: body.data.error.message, issues: body.data.error.issues ?? [] };
    }
    return { status: e.status, code: 'INTERNAL', message: 'Something went wrong.', issues: [] };
  }
  if (e.status === 'FETCH_ERROR' || e.status === 'TIMEOUT_ERROR') {
    return { status: 'NETWORK', code: 'NETWORK_ERROR', message: 'Cannot reach the server. Check the connection.', issues: [] };
  }
  if (e.status === 'PARSING_ERROR' || e.status === 'CUSTOM_ERROR') {
    return { status: 'PARSE', code: 'BAD_RESPONSE', message: 'The server sent a response this app does not understand.', issues: [] };
  }
  // A thrown error inside the client itself.
  return { status: 'PARSE', code: 'INTERNAL', message: 'Something went wrong.', issues: [] };
}

/** Per-endpoint options read by the base query. */
export interface EndpointOptions {
  /** Contract schema the response body must match. A mismatch becomes a BAD_RESPONSE error, not bad data. */
  readonly schema?: z.ZodType;
}

/**
 * Attaches the seat token, and drops the session when the server says the
 * token is no longer valid (left, kicked, or a stale tab).
 */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, EndpointOptions> = async (args, api, extraOptions) => {
  const env = api.extra as ApiEnvironment;
  const query = fetchBaseQuery({
    baseUrl: env.baseUrl,
    ...(env.fetchFn ? { fetchFn: env.fetchFn } : {}),
    prepareHeaders: (headers, { getState }) => {
      const token = selectToken(getState() as { session: SessionState });
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  });
  const sentToken = selectToken(api.getState() as { session: SessionState });
  const result = await query(args, api, {});
  if (result.error?.status === 401 && sentToken) api.dispatch(cleared());
  if (result.error || !extraOptions?.schema) return result;

  const parsed = extraOptions.schema.safeParse(result.data);
  if (parsed.success) return { ...result, data: parsed.data };
  return { error: { status: 'CUSTOM_ERROR', error: 'BAD_RESPONSE', data: parsed.error.issues } };
};

/**
 * The single RTK Query API. Feature endpoints are added with
 * `api.injectEndpoints` next to their feature (see `src/api/lobby.ts`).
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Lobby', 'Configuration', 'MyRole', 'HostRoster', 'GameState', 'MyActions'],
  endpoints: (build) => ({
    getHealth: build.query<HealthResponse, void>({
      query: () => 'health',
      extraOptions: { schema: healthResponseSchema },
    }),
  }),
});

export const { useGetHealthQuery } = api;
