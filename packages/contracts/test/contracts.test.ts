import { describe, expect, it } from 'vitest';
import { errorBodySchema, healthResponseSchema, versionResponseSchema } from '../src/index.js';

describe('system contracts', () => {
  it('accepts a healthy response and rejects anything else', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(healthResponseSchema.safeParse({ status: 'degraded' }).success).toBe(false);
  });

  it('accepts a version with or without a commit', () => {
    expect(versionResponseSchema.safeParse({ name: 'api', version: '0.0.0', commit: null }).success).toBe(true);
    expect(versionResponseSchema.safeParse({ name: 'api', version: '0.0.0' }).success).toBe(false);
  });
});

describe('error body', () => {
  it('accepts a known code', () => {
    const body = { error: { code: 'ACTION_WRONG_PHASE', message: 'That action is not available.' } };
    expect(errorBodySchema.parse(body)).toEqual(body);
  });

  it('rejects an unknown code', () => {
    expect(errorBodySchema.safeParse({ error: { code: 'TARGET_IS_A_WOLF', message: '' } }).success).toBe(false);
  });
});
