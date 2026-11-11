import type { Request } from 'express';

/**
 * How many join attempts one room, and one address, may make in the window (WW-1301).
 * The room cap sits above the largest preset (30 seats) so a real table can fill,
 * and a burst past it is refused. The address cap stops one client opening room
 * after room; it stays above the joins one test process makes from a single address.
 */
export const JOIN_ROOM_LIMIT = 40;
export const JOIN_IP_LIMIT = 1_000;
export const JOIN_WINDOW_MS = 10_000;

/**
 * A fixed window of timestamps. `allow` records the hit when it is under the
 * limit, so a burst past the limit is refused without forgetting the earlier hits.
 */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** True when another hit would still be inside the limit. Drops expired hits. */
  fits(key: string, now = Date.now()): boolean {
    const start = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > start);
    this.hits.set(key, recent);
    return recent.length < this.limit;
  }

  allow(key: string, now = Date.now()): boolean {
    if (!this.fits(key, now)) return false;
    this.hits.get(key)!.push(now);
    return true;
  }
}

/** Join attempts, counted per room and per client address. Each app has its own. */
export class JoinRateLimiter {
  private readonly byRoom = new SlidingWindow(JOIN_ROOM_LIMIT, JOIN_WINDOW_MS);
  private readonly byAddress = new SlidingWindow(JOIN_IP_LIMIT, JOIN_WINDOW_MS);

  /** True when both budgets still have room. A refusal consumes neither. */
  allow(address: string, roomCode: string, now = Date.now()): boolean {
    const roomKey = `${address}:${roomCode}`;
    if (!this.byAddress.fits(address, now) || !this.byRoom.fits(roomKey, now)) return false;
    this.byAddress.allow(address, now);
    this.byRoom.allow(roomKey, now);
    return true;
  }
}

/** The socket address. A forwarded header is not trusted; the proxy is not in front of version 1. */
export function clientAddress(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
