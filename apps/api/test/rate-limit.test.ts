import { describe, expect, it } from 'vitest';
import { JOIN_ROOM_LIMIT, JoinRateLimiter, SlidingWindow } from '../src/http/rate-limit.js';

describe('join rate limit (WW-1301)', () => {
  it('refuses the hit that passes the window, and a refusal does not consume the other budget', () => {
    const window = new SlidingWindow(2, 1_000);
    expect(window.allow('a', 0)).toBe(true);
    expect(window.allow('a', 10)).toBe(true);
    expect(window.allow('a', 20)).toBe(false);
    expect(window.allow('a', 1_100)).toBe(true);

    const joins = new JoinRateLimiter();
    for (let i = 0; i < JOIN_ROOM_LIMIT; i++) expect(joins.allow('127.0.0.1', 'ROOM01', i)).toBe(true);
    expect(joins.allow('127.0.0.1', 'ROOM01', JOIN_ROOM_LIMIT)).toBe(false);
    expect(joins.allow('127.0.0.1', 'ROOM02', JOIN_ROOM_LIMIT)).toBe(true);
  });
});
