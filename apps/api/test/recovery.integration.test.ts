import type { INestApplication } from '@nestjs/common';
import { gameStateSchema, seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase } from './support/test-database.js';

/**
 * WW-1302. After a night has resolved, a restart does not resolve it again.
 * A timed day whose deadline passed while the process was down still advances,
 * and the night's resolution_run stays at one.
 */

describe('boot recovery after night resolution (WW-1302)', () => {
  it('advances a passed day deadline and does not resolve the night a second time', async () => {
    const db = await createTestDatabase();
    const config = loadConfig({ DATABASE_URL: db.url });
    const before = await createApp(config, { logger: false });
    await before.init();
    let after: INestApplication | undefined;
    try {
      const api = () => request(before.getHttpServer());
      const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
      const host = seatCredentialsSchema.parse(created.body);
      const auth = { Authorization: `Bearer ${host.token}` };
      for (let i = 2; i <= 10; i++) await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
      await api().post(`/api/v1/games/${host.gameId}/start`).set(auth).send({ acknowledgeWarnings: true }).expect(200);

      const close = async (seat: SeatCredentials) => {
        const current = gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(auth).expect(200)).body);
        return gameStateSchema.parse(
          (await api().post(`/api/v1/games/${seat.gameId}/host/phase/close`).set(auth).send({ stateVersion: current.stateVersion }).expect(200)).body,
        );
      };
      expect((await close(host)).phase).toBe('NIGHT_SUBMIT');
      expect((await close(host)).phase).toBe('DAY_ANNOUNCE');
      expect((await close(host)).phase).toBe('DAY_DISCUSSION');
      const runs = async () =>
        (await db.pool.query<{ n: number }>(`select count(*)::int as n from resolution_runs where game_id = $1 and phase_kind = 'NIGHT'`, [host.gameId])).rows[0]!.n;
      expect(await runs()).toBe(1);

      await before.close();
      await db.pool.query(`update games set phase_ends_at = now() - interval '1 minute' where id = $1`, [host.gameId]);
      after = await createApp(config, { logger: false });
      await after.init();

      const phaseOf = async () =>
        (await db.pool.query<{ phase: string; round_number: number }>(`select phase, round_number from games where id = $1`, [host.gameId])).rows[0]!;
      let phase = await phaseOf();
      for (let i = 0; i < 50 && phase.phase === 'DAY_DISCUSSION'; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        phase = await phaseOf();
      }
      expect(phase).toMatchObject({ phase: 'VOTING', round_number: 1 });
      expect(await runs()).toBe(1);
    } finally {
      await after?.close();
      await db.drop();
    }
  });
});
