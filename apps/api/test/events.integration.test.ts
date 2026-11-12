import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { EventService } from '../src/events/event.service.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-804: after a night commits, investigation and infection facts are stored
 * as separate audience rows. A second publish does not duplicate them.
 */

let db: TestDatabase;
let app: INestApplication;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

interface SeatRow {
  readonly seq: string;
  readonly type: string;
  readonly audience: string;
  readonly recipient_player_id: string | null;
  readonly payload: Record<string, unknown>;
}

async function rows(gameId: string): Promise<SeatRow[]> {
  const { rows: found } = await db.pool.query<SeatRow>(
    `select seq::text, type, audience, recipient_player_id, payload from game_events where game_id = $1 order by seq`,
    [gameId],
  );
  return found;
}

async function state(seat: SeatCredentials): Promise<GameState> {
  return gameStateSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/state`).set(bearer(seat)).expect(200)).body);
}

async function closeUntil(host: SeatCredentials, phase: GameState['phase']): Promise<void> {
  let current = await state(host);
  for (let i = 0; current.phase !== phase; i++) {
    if (i > 12) throw new Error(`never reached ${phase}`);
    if (current.phase === 'NIGHT_HOST_CONFIRM') {
      await api().post(`/api/v1/games/${host.gameId}/host/kill-target`).set(bearer(host)).send({ noKill: true }).expect(200);
    }
    current = gameStateSchema.parse(
      (await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: current.stateVersion }).expect(200)).body,
    );
  }
}

async function started(mode: 'CLASSIC' | 'INFECTION', players: number) {
  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode }).expect(201);
  const host = seatCredentialsSchema.parse(created.body);
  const all = [host];
  for (let i = 2; i <= players; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    all.push(seatCredentialsSchema.parse(joined.body));
  }
  await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
  await closeUntil(host, 'NIGHT_SUBMIT');
  return {
    host,
    all,
    async seats(roleId: string) {
      const { rows: found } = await db.pool.query<{ player_id: string }>(
        `select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id`,
        [host.gameId, roleId],
      );
      return found.map((row) => all.find((seat) => seat.playerId === row.player_id)!);
    },
    async ability(seat: SeatCredentials, abilityId: string) {
      const { rows: found } = await db.pool.query<{ id: string }>(
        `select id from ability_instances where player_id = $1 and ability_id = $2 and source = 'NATIVE'`,
        [seat.playerId, abilityId],
      );
      return found[0]!.id;
    },
  };
}

async function act(gameId: string, seat: SeatCredentials, abilityInstanceId: string, targets: SeatCredentials[]) {
  await api()
    .post(`/api/v1/games/${gameId}/actions`)
    .set(bearer(seat))
    .set('Idempotency-Key', randomUUID())
    .send({ abilityInstanceId, targetPlayerIds: targets.map((target) => target.playerId) })
    .expect(200);
}

describe('private result events (WW-804)', () => {
  it('stores the Seeker result for the Seeker and the host, and the death for everyone', async () => {
    const game = await started('CLASSIC', 10);
    const wolves = await game.seats('pack_wolf');
    const [seeker] = await game.seats('seeker');
    const [victim] = await game.seats('normal_villager');
    await act(game.host.gameId, wolves[0]!, await game.ability(wolves[0]!, 'pack_kill'), [victim!]);
    await act(game.host.gameId, wolves[1]!, await game.ability(wolves[1]!, 'pack_kill'), [victim!]);
    await act(game.host.gameId, seeker!, await game.ability(seeker!, 'seeker_investigate'), [wolves[0]!]);
    await closeUntil(game.host, 'DAY_ANNOUNCE');

    const events = await rows(game.host.gameId);
    const investigation = events.filter((row) => row.type === 'INVESTIGATION_RESULT');
    expect(investigation.map((row) => row.audience).sort()).toEqual(['HOST', 'PLAYER']);
    const playerCopy = investigation.find((row) => row.audience === 'PLAYER')!;
    expect(playerCopy.recipient_player_id).toBe(seeker!.playerId);
    expect(playerCopy.payload).toMatchObject({ result: { value: 'WOLF' } });
    expect(JSON.stringify(playerCopy.payload)).not.toContain('pack_wolf');
    expect(playerCopy.payload).not.toHaveProperty('actorPlayerId');
    expect(investigation.find((row) => row.audience === 'HOST')!.payload).toMatchObject({ actorPlayerId: seeker!.playerId });

    const death = events.find((row) => row.type === 'PLAYER_ELIMINATED')!;
    expect(death.audience).toBe('PUBLIC');
    expect(death.payload).toMatchObject({ playerId: victim!.playerId, roleId: 'normal_villager' });
    // The night adds no public fact but the death. The phase signal (WW-1103) is public too, and names no one.
    expect(events.filter((row) => row.audience === 'PUBLIC' && row.type !== 'PHASE_CHANGED').every((row) => row.type === 'PLAYER_ELIMINATED')).toBe(true);
    expect(events.some((row) => row.type === 'NIGHT_PUBLISHED')).toBe(true);

    const before = events.length;
    expect(await app.get(EventService).publishNight(game.host.gameId, 1)).toEqual([]);
    expect(await rows(game.host.gameId)).toHaveLength(before);
  });

  it('tells the converted player their new role and not who infected them', async () => {
    const game = await started('INFECTION', 20);
    const [alpha] = await game.seats('alpha_wolf');
    const seekers = await game.seats('seeker');
    const target = seekers[1]!;
    await act(game.host.gameId, alpha!, await game.ability(alpha!, 'alpha_infect'), [target]);
    await closeUntil(game.host, 'DAY_ANNOUNCE');

    const events = await rows(game.host.gameId);
    const playerCopies = events.filter((row) => row.audience === 'PLAYER' && row.recipient_player_id === target.playerId);
    expect(playerCopies.map((row) => row.type).sort()).toEqual(['INFECTION_OCCURRED', 'ROLE_CONVERTED']);
    for (const row of playerCopies) {
      expect(JSON.stringify(row.payload)).not.toContain(alpha!.playerId);
      expect(row.payload).not.toHaveProperty('sourcePlayerId');
    }
    expect(playerCopies.find((row) => row.type === 'INFECTION_OCCURRED')!.payload).toMatchObject({ roleId: 'infected_wolf' });
    const hostCopy = events.find((row) => row.type === 'INFECTION_OCCURRED' && row.audience === 'HOST')!;
    expect(hostCopy.payload).toMatchObject({ sourcePlayerId: alpha!.playerId, targetPlayerId: target.playerId, roleId: 'infected_wolf' });
  });
});
