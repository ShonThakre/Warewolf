import { describe, expect, it } from 'vitest';
import { gameEventsResponseSchema } from '../src/events.js';

describe('game events', () => {
  it('parses a public death and drops nothing the schema names', () => {
    const body = gameEventsResponseSchema.parse({
      events: [{ seq: 1, type: 'PLAYER_ELIMINATED', audience: 'PUBLIC', payload: { playerId: '00000000-0000-4000-8000-000000000003' } }],
    });
    expect(body.events).toHaveLength(1);
  });
});
