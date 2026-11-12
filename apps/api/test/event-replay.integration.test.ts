import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { gameEventsResponseSchema, gameStateSchema, seatCredentialsSchema, type GameState, type SeatCredentials } from '@warewolf/contracts';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-1102. A private result is emitted to the seat that may see it. Killing
 * the socket and rejoining with `afterSeq` delivers that result once.
 */

let db: TestDatabase;
let app: INestApplication;
let port: number;

const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

function connect(token: string): Socket {
  return io(`http://127.0.0.1:${port}/play`, { auth: { token }, transports: ['websocket'] });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 8_000);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function join(socket: Socket, gameId: string, afterSeq = 0): Promise<{ ok: boolean }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-session timed out')), 4_000);
    socket.emit('join-session', { gameId, afterSeq }, (result: { ok: boolean }) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
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

describe('event replay (WW-1102)', () => {
  it('delivers a private result once, on the socket and again only before afterSeq', async () => {
    const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'CLASSIC' }).expect(201);
    const host = seatCredentialsSchema.parse(created.body);
    const seats = [host];
    for (let i = 2; i <= 10; i++) {
      const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
      seats.push(seatCredentialsSchema.parse(joined.body));
    }
    await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({ acknowledgeWarnings: true }).expect(200);
    await closeUntil(host, 'NIGHT_SUBMIT');

    const byRole = async (roleId: string) => {
      const { rows } = await db.pool.query<{ player_id: string }>(
        `select player_id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id`,
        [host.gameId, roleId],
      );
      return rows.map((row) => seats.find((seat) => seat.playerId === row.player_id)!);
    };
    const ability = async (seat: SeatCredentials, abilityId: string) => {
      const { rows } = await db.pool.query<{ id: string }>(
        `select id from ability_instances where player_id = $1 and ability_id = $2 and source = 'NATIVE'`,
        [seat.playerId, abilityId],
      );
      return rows[0]!.id;
    };
    const act = async (seat: SeatCredentials, abilityId: string, target: SeatCredentials) => {
      await api()
        .post(`/api/v1/games/${host.gameId}/actions`)
        .set(bearer(seat))
        .set('Idempotency-Key', randomUUID())
        .send({ abilityInstanceId: await ability(seat, abilityId), targetPlayerIds: [target.playerId] })
        .expect(200);
    };

    const wolves = await byRole('pack_wolf');
    const [seeker] = await byRole('seeker');
    const [victim] = await byRole('normal_villager');
    const villager = seats.find(
      (seat) => !seat.isHost && seat.playerId !== seeker!.playerId && seat.playerId !== victim!.playerId && !wolves.some((wolf) => wolf.playerId === seat.playerId),
    )!;
    await act(wolves[0]!, 'pack_kill', victim!);
    await act(wolves[1]!, 'pack_kill', victim!);
    await act(seeker!, 'seeker_investigate', wolves[0]!);

    const seekerSocket = connect(seeker!.token);
    const villagerSocket = connect(villager.token);
    await Promise.all([once(seekerSocket, 'connect'), once(villagerSocket, 'connect')]);
    expect(await join(seekerSocket, host.gameId)).toEqual({ ok: true });
    expect(await join(villagerSocket, host.gameId)).toEqual({ ok: true });

    const seen: { seq: number; audience: string; payload: { result?: { value?: string }; actorPlayerId?: string } }[] = [];
    const playerCopy = new Promise<(typeof seen)[number]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for the player result')), 8_000);
      seekerSocket.on('INVESTIGATION_RESULT', (event: (typeof seen)[number]) => {
        seen.push(event);
        if (event.audience !== 'PLAYER') return;
        clearTimeout(timer);
        resolve(event);
      });
    });
    const death = once(villagerSocket, 'PLAYER_ELIMINATED');
    let leaked = 0;
    villagerSocket.on('INVESTIGATION_RESULT', () => {
      leaked += 1;
    });
    await closeUntil(host, 'DAY_ANNOUNCE');
    const fact = await playerCopy;
    await death;
    expect(leaked).toBe(0);
    expect(seen.filter((event) => event.audience === 'PLAYER')).toHaveLength(1);
    expect(fact.payload.result?.value).toBe('WOLF');
    expect(fact.payload).not.toHaveProperty('actorPlayerId');
    expect(JSON.stringify(fact.payload)).not.toContain('pack_wolf');

    seekerSocket.close();
    const again = connect(seeker!.token);
    await once(again, 'connect');
    let repeats = 0;
    again.on('INVESTIGATION_RESULT', () => {
      repeats += 1;
    });
    const caughtUpThrough = Math.max(...seen.map((event) => event.seq));
    expect(await join(again, host.gameId, caughtUpThrough)).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(repeats).toBe(0);
    again.close();
    villagerSocket.close();

    const seekerEvents = gameEventsResponseSchema.parse(
      (await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(seeker!)).expect(200)).body,
    );
    expect(seekerEvents.events.some((event) => event.type === 'INVESTIGATION_RESULT' && event.audience === 'PLAYER')).toBe(true);
    expect(seekerEvents.events.some((event) => event.audience === 'HOST')).toBe(false);
    const after = gameEventsResponseSchema.parse(
      (await api().get(`/api/v1/games/${host.gameId}/events?afterSeq=${fact.seq}`).set(bearer(seeker!)).expect(200)).body,
    );
    expect(after.events.some((event) => event.seq <= fact.seq)).toBe(false);

    const villagerEvents = gameEventsResponseSchema.parse(
      (await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(villager)).expect(200)).body,
    );
    expect(villagerEvents.events.some((event) => event.type === 'INVESTIGATION_RESULT')).toBe(false);
    expect(villagerEvents.events.some((event) => event.type === 'PLAYER_ELIMINATED')).toBe(true);

    const hostEvents = gameEventsResponseSchema.parse((await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(host)).expect(200)).body);
    expect(hostEvents.events.find((event) => event.type === 'INVESTIGATION_RESULT')?.payload).toMatchObject({ actorPlayerId: seeker!.playerId });

    const other = seatCredentialsSchema.parse((await api().post('/api/v1/games').send({ displayName: 'Other', mode: 'CLASSIC' }).expect(201)).body);
    await api().get(`/api/v1/games/${host.gameId}/events`).set(bearer(other)).expect(404);
    await api().get(`/api/v1/games/${host.gameId}/events?afterSeq=later`).set(bearer(host)).expect(422);
  });
});
