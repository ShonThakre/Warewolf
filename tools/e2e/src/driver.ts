import { randomUUID } from 'node:crypto';
import type {
  ConfigurationResponse,
  DayTally,
  GameEvent,
  GameResults,
  GameState,
  HostRoster,
  KillTargetView,
  LobbyProjection,
  MyActions,
  MyRole,
  SeatCredentials,
} from '@warewolf/contracts';
import { Http, HttpError, type ApiResponse } from './http.js';

/**
 * One game, driven only through the public HTTP API. Seats, roles, and
 * ability ids come from `/me`, `/me/actions`, and the host roster, never
 * from the database, so the same driver runs against a local server, the
 * in-process test app, or a deployed one.
 */

export type ConfigurationDraft = ConfigurationResponse['draft'];

export type GameMode = 'INFECTION' | 'CLASSIC' | 'EXPANDED' | 'CUSTOM' | 'ULTIMATE_20';

export interface Seat extends SeatCredentials {
  readonly displayName: string;
}

export interface Choice {
  readonly targetPlayerIds: readonly string[];
  readonly payload?: Readonly<Record<string, string | number | boolean>>;
}

export type KillDecisionRequest = { readonly targetPlayerId: string } | { readonly noKill: true };

export interface CreateOptions {
  readonly mode?: GameMode;
  readonly hostName?: string;
  /** Prefix for joined seats: `Player 2`, `Player 3`, … */
  readonly seatPrefix?: string;
}

export class GameDriver {
  readonly seats: Seat[];
  private readonly prefix: string;

  private constructor(
    readonly http: Http,
    host: Seat,
    prefix: string,
  ) {
    this.seats = [host];
    this.prefix = prefix;
  }

  static async create(http: Http, options: CreateOptions = {}): Promise<GameDriver> {
    const displayName = options.hostName ?? 'Host';
    const body = await http.ok<SeatCredentials>('POST', '/games', {
      body: { displayName, ...(options.mode ? { mode: options.mode } : {}) },
    });
    return new GameDriver(http, { ...body, displayName }, options.seatPrefix ?? 'Player');
  }

  /** Builds a driver for a game whose host credentials already exist, such as one created in a browser. */
  static attach(http: Http, host: Seat, seatPrefix = 'Player'): GameDriver {
    return new GameDriver(http, host, seatPrefix);
  }

  get host(): Seat {
    return this.seats[0]!;
  }

  get gameId(): string {
    return this.host.gameId;
  }

  get roomCode(): string {
    return this.host.roomCode;
  }

  private path(suffix = ''): string {
    return `/games/${this.gameId}${suffix}`;
  }

  seat(playerId: string): Seat {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) throw new Error(`no seat ${playerId}`);
    return seat;
  }

  // Lobby

  async join(displayName = `${this.prefix} ${this.seats.length + 1}`): Promise<Seat> {
    const body = await this.http.ok<SeatCredentials>('POST', '/games/join', { body: { roomCode: this.roomCode, displayName } });
    const seat = { ...body, displayName };
    this.seats.push(seat);
    return seat;
  }

  /** Joins seats until the saved configuration's player count is reached. */
  async fill(count?: number): Promise<Seat[]> {
    const target = count ?? (await this.configuration()).draft.playerCount;
    while (this.seats.length < target) await this.join();
    return this.seats;
  }

  lobby(seat: Seat = this.host): Promise<LobbyProjection> {
    return this.http.ok('GET', this.path(), { token: seat.token });
  }

  configuration(): Promise<ConfigurationResponse> {
    return this.http.ok('GET', this.path('/configuration'), { token: this.host.token });
  }

  saveConfiguration(draft: ConfigurationDraft): Promise<ConfigurationResponse> {
    return this.http.ok('PUT', this.path('/configuration'), { token: this.host.token, body: draft });
  }

  async packConfig(packId: string): Promise<ConfigurationDraft> {
    const pack = await this.http.ok<{ config: ConfigurationDraft }>('GET', `/role-packs/${packId}`);
    return pack.config;
  }

  /** Saves a pack's configuration, optionally changed first. */
  async applyPack(packId: string, change?: (draft: ConfigurationDraft) => ConfigurationDraft): Promise<ConfigurationDraft> {
    const config = await this.packConfig(packId);
    const draft = change ? change(config) : config;
    const saved = await this.saveConfiguration(draft);
    if (saved.validation.errors.length > 0) throw new Error(`pack ${packId} saved with errors: ${JSON.stringify(saved.validation.errors)}`);
    return saved.draft;
  }

  startRaw(): Promise<ApiResponse> {
    return this.http.request('POST', this.path('/start'), { token: this.host.token, body: { acknowledgeWarnings: true } });
  }

  async start(): Promise<void> {
    const res = await this.startRaw();
    if (res.status !== 200) throw new HttpError('POST', this.path('/start'), res.status, res.body);
  }

  cancel(): Promise<LobbyProjection> {
    return this.http.ok('POST', this.path('/host/cancel'), { token: this.host.token });
  }

  // Reading the game

  state(seat: Seat = this.host): Promise<GameState> {
    return this.http.ok('GET', this.path('/state'), { token: seat.token });
  }

  me(seat: Seat): Promise<MyRole> {
    return this.http.ok('GET', this.path('/me'), { token: seat.token });
  }

  myActions(seat: Seat): Promise<MyActions> {
    return this.http.ok('GET', this.path('/me/actions'), { token: seat.token });
  }

  roster(): Promise<HostRoster> {
    return this.http.ok('GET', this.path('/host/roster'), { token: this.host.token });
  }

  async events(seat: Seat, afterSeq = 0): Promise<GameEvent[]> {
    const body = await this.http.ok<{ events: GameEvent[] }>('GET', this.path(`/events?afterSeq=${afterSeq}`), { token: seat.token });
    return body.events;
  }

  resultsRaw(seat: Seat = this.host): Promise<ApiResponse<GameResults>> {
    return this.http.request('GET', this.path('/results'), { token: seat.token });
  }

  async results(seat: Seat = this.host): Promise<GameResults> {
    return this.http.ok('GET', this.path('/results'), { token: seat.token });
  }

  // Acting

  submit(seat: Seat, abilityInstanceId: string, choice: Choice): Promise<ApiResponse> {
    return this.http.request('POST', this.path('/actions'), {
      token: seat.token,
      headers: { 'Idempotency-Key': randomUUID() },
      body: { abilityInstanceId, targetPlayerIds: choice.targetPlayerIds, ...(choice.payload ? { payload: choice.payload } : {}) },
    });
  }

  vote(seat: Seat, targetPlayerId: string | null): Promise<ApiResponse> {
    return this.http.request('POST', this.path('/votes'), { token: seat.token, body: { targetPlayerId } });
  }

  killTarget(): Promise<KillTargetView> {
    return this.http.ok('GET', this.path('/host/kill-target'), { token: this.host.token });
  }

  setKillTarget(decision: KillDecisionRequest): Promise<KillTargetView> {
    return this.http.ok('POST', this.path('/host/kill-target'), { token: this.host.token, body: decision });
  }

  async tallies(seat: Seat = this.host): Promise<DayTally[]> {
    const body = await this.http.ok<{ tallies: DayTally[] }>('GET', this.path('/tallies'), { token: seat.token });
    return body.tallies;
  }

  chat(seat: Seat, body: string): Promise<ApiResponse> {
    return this.http.request('POST', this.path('/chat/messages'), { token: seat.token, body: { body } });
  }

  closeRaw(stateVersion: number): Promise<ApiResponse<GameState>> {
    return this.http.request('POST', this.path('/host/phase/close'), { token: this.host.token, body: { stateVersion } });
  }

  /** Closes the current phase from the latest state version. */
  async close(): Promise<GameState> {
    const current = await this.state();
    const res = await this.closeRaw(current.stateVersion);
    if (res.status !== 200) throw new HttpError('POST', this.path('/host/phase/close'), res.status, res.body);
    return res.body;
  }
}
