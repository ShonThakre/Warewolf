import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { gameStateSchema, hostRosterSchema, myActionsSchema, myRoleSchema, seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import { drizzle } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changeAssignment } from '../src/assignment/assignment.repository.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import * as schema from '../src/db/schema.js';
import { createTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * WW-702: Infection Edition wolves do not learn each other (C-07, OD-46).
 * The game below has an Alpha and one Infected Wolf, converted the way the
 * night resolver (WW-802) will write it.
 */

let db: TestDatabase;
let app: INestApplication;
const api = () => request(app.getHttpServer());
const bearer = (seat: SeatCredentials) => ({ Authorization: `Bearer ${seat.token}` });

let host: SeatCredentials;
let alpha: SeatCredentials;
let infected: SeatCredentials;

beforeAll(async () => {
  db = await createTestDatabase();
  app = await createApp(loadConfig({ DATABASE_URL: db.url }), { logger: false });
  await app.init();

  const created = await api().post('/api/v1/games').send({ displayName: 'Host', mode: 'INFECTION' }).expect(201);
  host = seatCredentialsSchema.parse(created.body);
  const seats = [host];
  for (let i = 2; i <= 20; i++) {
    const joined = await api().post('/api/v1/games/join').send({ roomCode: host.roomCode, displayName: `Player ${i}` }).expect(201);
    seats.push(seatCredentialsSchema.parse(joined.body));
  }
  await api().post(`/api/v1/games/${host.gameId}/start`).set(bearer(host)).send({}).expect(200);

  const roleOf = async (roleId: string) =>
    (await db.pool.query<{ player_id: string; id: string }>(`select player_id, id from role_assignments where game_id = $1 and original_role_id = $2 order by player_id limit 1`, [host.gameId, roleId])).rows[0]!;
  const alphaRow = await roleOf('alpha_wolf');
  const villagerRow = await roleOf('normal_villager');
  alpha = seats.find((s) => s.playerId === alphaRow.player_id)!;
  infected = seats.find((s) => s.playerId === villagerRow.player_id)!;

  // A conversion as WW-802 will write it: current role and faction change, the kill is granted from round 1 for this test.
  const orm = drizzle(db.pool, { schema });
  await changeAssignment(orm, villagerRow.id, { currentRoleId: 'infected_wolf', currentProfileId: 'infected_wolf', currentFaction: 'WOLF_PACK', wolfAligned: true });
  const kill = DEFAULT_CATALOG.byId.get('infected_wolf')!.profiles['infected_wolf']!.abilities[0]!;
  await orm.insert(schema.abilityInstances).values({
    gameId: host.gameId,
    playerId: infected.playerId,
    assignmentId: villagerRow.id,
    abilityId: kill.id,
    capability: kill.capability,
    handlerKey: kill.handlerKey,
    availableFromRound: 1,
    source: 'NATIVE',
    config: kill,
  });

  // Into night 1.
  const state = gameStateSchema.parse((await api().get(`/api/v1/games/${host.gameId}/state`).set(bearer(host)).expect(200)).body);
  await api().post(`/api/v1/games/${host.gameId}/host/phase/close`).set(bearer(host)).send({ stateVersion: state.stateVersion }).expect(200);
});

afterAll(async () => {
  await app?.close();
  await db?.drop();
});

const meOf = async (seat: SeatCredentials) => (await api().get(`/api/v1/games/${seat.gameId}/me`).set(bearer(seat)).expect(200)).body;

describe('wolf anonymity in Infection Edition (WW-702)', () => {
  it('neither wolf has a teammate list, and neither /me names the other', async () => {
    for (const [self, otherWolf] of [
      [alpha, infected],
      [infected, alpha],
    ] as const) {
      const raw = await meOf(self);
      expect(myRoleSchema.parse(raw)).toMatchObject({ teammatesVisible: false, teammates: [] });
      expect(JSON.stringify(raw)).not.toContain(otherWolf.playerId);
    }
    expect(myRoleSchema.parse(await meOf(infected)).currentRole).toMatchObject({ id: 'infected_wolf', faction: 'WOLF_PACK' });
  });

  it('gives both wolves the same kill target rule, with no allied players in it', async () => {
    const rule = (raw: unknown, abilityId: string) => myRoleSchema.parse(raw).abilities.find((a) => a.abilityId === abilityId)!.target;
    const alphaKill = rule(await meOf(alpha), 'alpha_kill');
    expect(alphaKill).toEqual(rule(await meOf(infected), 'infected_kill'));
    expect(alphaKill).toEqual({ kind: 'PLAYERS', count: 1, life: 'ALIVE', self: false, notSameAsLastRound: false });
  });

  it('shows each wolf only their own submission (OD-46)', async () => {
    const state = gameStateSchema.parse((await api().get(`/api/v1/games/${host.gameId}/state`).set(bearer(host)).expect(200)).body);
    const targetId = state.players.find((p) => p.playerId !== alpha.playerId && p.playerId !== infected.playerId)!.playerId;
    const submit = async (seat: SeatCredentials, abilityId: string, targets: string[]) => {
      const mine = myActionsSchema.parse((await api().get(`/api/v1/games/${seat.gameId}/me/actions`).set(bearer(seat)).expect(200)).body);
      const ability = mine.abilities.find((a) => a.abilityId === abilityId)!;
      await api().post(`/api/v1/games/${seat.gameId}/actions`).set(bearer(seat)).set('Idempotency-Key', randomUUID()).send({ abilityInstanceId: ability.abilityInstanceId, targetPlayerIds: targets }).expect(200);
    };
    // Friendly fire is on (C-08), so the infected wolf may name the Alpha without learning anything.
    await submit(alpha, 'alpha_kill', [targetId]);
    await submit(infected, 'infected_kill', [alpha.playerId]);

    for (const [self, otherWolf] of [
      [alpha, infected],
      [infected, alpha],
    ] as const) {
      const raw = (await api().get(`/api/v1/games/${self.gameId}/me/actions`).set(bearer(self)).expect(200)).body;
      const mine = myActionsSchema.parse(raw);
      const actions = mine.abilities.flatMap((a) => (a.action ? [a.action] : []));
      expect(actions).toHaveLength(1);
      // The infected wolf's own action names the Alpha as its target, and nothing else names the other wolf.
      if (self === alpha) expect(JSON.stringify(raw)).not.toContain(otherWolf.playerId);
      const state = (await api().get(`/api/v1/games/${self.gameId}/state`).set(bearer(self)).expect(200)).body;
      for (const role of DEFAULT_CATALOG.roles) expect(JSON.stringify(state)).not.toContain(`"${role.id}"`);
    }
  });

  it('lets only the host see both wolves', async () => {
    const roster = hostRosterSchema.parse((await api().get(`/api/v1/games/${host.gameId}/host/roster`).set(bearer(host)).expect(200)).body);
    expect(roster.players.filter((p) => p.currentFaction === 'WOLF_PACK').map((p) => p.playerId).sort()).toEqual([alpha.playerId, infected.playerId].sort());
    // A wolf who is not also the host cannot read the roster.
    for (const wolf of [alpha, infected].filter((w) => !w.isHost)) {
      await api().get(`/api/v1/games/${wolf.gameId}/host/roster`).set(bearer(wolf)).expect(403);
    }
  });
});
