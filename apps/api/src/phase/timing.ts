import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';

/** The time source for phase deadlines. Tests bind a controllable clock through `createApp`. */
export interface Clock {
  now(): Date;
}

export const PHASE_CLOCK = Symbol('PHASE_CLOCK');

export const systemClock: Clock = { now: () => new Date() };

/**
 * Runs a phase's timed close at its deadline (WW-502). One entry per game:
 * scheduling again replaces the earlier entry. Tests bind a manual
 * scheduler so they can fire a deadline without waiting for it.
 *
 * Entries live in memory. That is enough for the single API process of
 * version 1 (api-design.md, section 11): a restart loses them, and boot
 * recovery schedules every open deadline again from the database.
 */
export interface PhaseScheduler {
  schedule(gameId: string, at: Date, task: () => Promise<void>): void;
  cancel(gameId: string): void;
}

export const PHASE_SCHEDULER = Symbol('PHASE_SCHEDULER');

/** setTimeout's ceiling. A later deadline fires early, finds it is not due, and schedules again. */
const MAX_DELAY_MS = 2 ** 31 - 1;

@Injectable()
export class TimeoutScheduler implements PhaseScheduler, OnApplicationShutdown {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(@Inject(PHASE_CLOCK) private readonly clock: Clock) {}

  schedule(gameId: string, at: Date, task: () => Promise<void>): void {
    this.cancel(gameId);
    const delay = Math.min(Math.max(0, at.getTime() - this.clock.now().getTime()), MAX_DELAY_MS);
    const timer = setTimeout(() => {
      this.timers.delete(gameId);
      void task();
    }, delay);
    // A pending deadline must not keep a stopping process alive; the HTTP server already does while it runs.
    timer.unref();
    this.timers.set(gameId, timer);
  }

  cancel(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (timer) clearTimeout(timer);
    this.timers.delete(gameId);
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
