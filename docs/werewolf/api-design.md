# API Design

Base path: `/api/v1`.

The request and response schemas for implemented routes live in `packages/contracts` and are the source of truth. Lobby, configuration, catalog, and pack routes are implemented as of 9 November 2026 (WW-302, WW-303). The lobby projection adds a `start` object, `{ ready, blockers, requiresWarningAcknowledgement }`, so the client can show why start is closed. Start, `GET /me`, and `GET /host/roster` are implemented (WW-402, WW-403); their schemas are in `packages/contracts/src/assignment.ts`. `GET /state` and `POST /host/phase/close` are implemented (WW-501 to WW-503); their schemas are in `packages/contracts/src/phase.ts`. `POST /actions` and `GET /me/actions` are implemented (WW-601 to WW-603); their schemas are in `packages/contracts/src/action.ts`.

Transport split:

- HTTP for commands that must return validation errors and for snapshots.
- Socket.IO for live projections after the client has loaded a snapshot.

The server builds three projections: `Public`, `Player`, and `Host`. Handlers pick one. They do not return the database row.

Authentication: `Authorization: Bearer <token>`. Creating or joining a game returns the raw token once. The database stores a hash.

Authorization:

| Token | May do |
|---|---|
| None | Create, join, read the public role catalog |
| Player | Act as that seat, read that seat's private projection |
| Host player | Player rights plus host commands and the host projection |

A token for game A used on game B returns 404. The response does not reveal whether game B exists.

Error body:

```json
{ "error": { "code": "ACTION_WRONG_PHASE", "message": "That action is not available." } }
```

Messages are generic. They must not include another player's role, an investigation result, or "target is a wolf."

Stable codes include: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `ROOM_FULL`, `GAME_STARTED`, `DISPLAY_NAME_TAKEN`, `AVATAR_TAKEN`, `CONFIG_INVALID`, `SEAT_COUNT_MISMATCH`, `WARNINGS_UNACKNOWLEDGED`, `ACTION_WRONG_PHASE`, `ACTION_DEAD`, `ACTION_NOT_YOUR_ABILITY`, `ACTION_NO_CHARGES`, `ACTION_TARGET_ILLEGAL`, `ACTION_DUPLICATE`, `VOTE_INELIGIBLE`, `NOT_HOST`, `PHASE_CONFLICT`, `IDEMPOTENCY_CONFLICT`.

Validation failures for configuration return 422 with the error and warning list from the domain validator. Those messages describe the draft, which the host already wrote, so they may name role ids.

---

## 1. Lobby

### POST `/games`

Create a room and the host seat.

Auth: none.

Request:

```json
{ "displayName": "Asha", "mode": "INFECTION" }
```

Response 201:

```json
{
  "gameId": "0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31",
  "roomCode": "K7QMPR",
  "playerId": "5c1d0e77-1a2b-4c3d-8e9f-001122334455",
  "token": "<shown once>",
  "isHost": true
}
```

Validation: display name length and characters. Mode must exist.

Errors: 422 invalid name.

### POST `/games/join`

Request: `{ "roomCode": "K7QMPR", "displayName": "Rafi" }`

Response 201: `{ "gameId", "playerId", "token", "isHost": false }`

Errors: 404 unknown code, 409 room full or started, 409 name taken, 429 `RATE_LIMITED`. One room accepts 40 join attempts per 10 seconds, which is above the 30-seat preset, and one client address accepts 1,000 in that same window. A refusal uses neither budget. The address is the socket address; `X-Forwarded-For` is not trusted.

### GET `/games/:gameId`

Auth: member.

Response: lobby projection. Players see seat names, host id, mode name, player count, and their own seat. They do not see the full draft if the product decision is to hide the wolf count before start. **Recommendation:** before start, every member may see the configuration summary, because the host is configuring in front of the table. Secret roles do not exist yet. After start, this endpoint returns the public game projection only.

### PUT `/games/:gameId/me/avatar`

Auth: member. Lobby only. Body: `{ "avatarId": 1-36 }`. Returns the lobby projection. 409 `AVATAR_TAKEN` when another seat has that avatar, 409 `GAME_STARTED` after start. Create and join also accept an optional `avatarId`; without one the server assigns the lowest free avatar.

### POST `/games/:gameId/leave`

Auth: member. Lobby only. Host leave cancels the room, or transfers host if a `hostPlayerId` is included. Recommended default: host leave in lobby cancels.

### POST `/games/:gameId/start`

Auth: host. Lobby only. Body: `{ "acknowledgeWarnings": true }`. The body is strict: any other key, such as `seed`, is a 422 `VALIDATION_FAILED`. An empty body means `acknowledgeWarnings: false`.

In one transaction under the game row lock, the server validates the draft again, deals roles, writes assignments and ability instances, freezes the draft into `config_snapshot` with the catalog hash, sets round 1, and moves to `ROLE_REVEAL`. Socket events arrive in Phase 11; until then clients see the change by polling the lobby projection.

Response 200, public facts only. Each seat reads its own role from `GET /games/:gameId/me`.

```json
{ "gameId": "0f4c…", "status": "ACTIVE", "phase": "ROLE_REVEAL", "roundNumber": 1, "stateVersion": 20 }
```

Errors, checked in this order:

| Status | Code | When |
|---|---|---|
| 403 | `NOT_HOST` | The caller is not the host |
| 409 | `GAME_STARTED` | The game left the lobby, including a second or racing start |
| 422 | `CONFIG_INVALID` | The saved draft does not validate. `GET .../configuration` has the details |
| 409 | `SEAT_COUNT_MISMATCH` | Seats taken differ from the configured player count |
| 422 | `WARNINGS_UNACKNOWLEDGED` | The draft has warnings and `acknowledgeWarnings` was not `true` |

---

## 2. Configuration

### GET `/games/:gameId/configuration`

Auth: member in lobby. Returns the draft, derived counts, errors, and warnings.

### PUT `/games/:gameId/configuration`

Auth: host. Lobby only.

Request is a configuration draft. Response is the validated draft including derived faction counts. Saving an invalid draft is allowed so the host can edit in steps. Starting is not allowed.

### POST `/games/:gameId/configuration/validate`

Auth: host. Same response as PUT without saving. Optional convenience.

---

## 3. Role catalog and packs

### GET `/role-catalog`

Auth: none. Returns definitions safe to show in a browser: names, descriptions, categories, default factions, ability summaries, and `implementationStatus`. It does not return handler source.

### GET `/role-catalog/:roleId`

Auth: none. One definition.

### GET `/role-packs`

Auth: none. Pack ids, descriptions, counts, and whether the pack has warnings.

### GET `/role-packs/:packId`

Auth: none. The preset draft.

These routes are public reference data. They are not game secrets.

---

## 4. Role assignment and private role

There is no client "assign this role" command in version 1.

### GET `/games/:gameId/me`

Auth: player. 409 `PHASE_CONFLICT` before the deal.

```json
{
  "gameId": "0f4c…",
  "playerId": "5c1d…",
  "displayName": "Rafi",
  "seatNumber": 4,
  "lifeStatus": "ALIVE",
  "originalRole": { "id": "seeker", "profileId": "seeker", "name": "Seeker", "faction": "VILLAGE" },
  "currentRole": { "id": "seeker", "profileId": "seeker", "name": "Seeker", "faction": "VILLAGE" },
  "abilities": [
    {
      "abilityInstanceId": "ab1…",
      "abilityId": "seeker_investigate",
      "capability": "INVESTIGATE",
      "timing": "NIGHT",
      "status": "ACTIVE",
      "usesRemaining": null,
      "usesPerPhase": 1,
      "cooldownNights": 0,
      "availableFromRound": 1,
      "onlyRound": null,
      "expiresRound": null,
      "target": { "kind": "PLAYERS", "count": 1, "life": "ALIVE", "self": false, "notSameAsLastRound": false }
    }
  ],
  "teammatesVisible": false,
  "teammates": []
}
```

As built (WW-403), the projection differs from the first sketch in three ways:

- Abilities carry structured limits and the target rule instead of a `prompt` string. The client writes the sentences, so copy lives with the UI.
- `available` (usable right now) is not sent yet. It needs the phase windows and cooldown checks of Phase 5 and 6, and arrives with WW-601 to WW-603.
- `privateNotes` is not sent. Private facts arrive as player-audience events (Phase 11).

`teammates` lists seats and names, never roles. It is filled only when `teammatesVisible` is true: Classic Pack Wolves when `wolves.knowsTeammates` is on. It is always empty in Infection Edition. Revoked abilities are left out.

After infection, `currentRole` becomes Infected Wolf and `abilities` lists the kill action only when the round allows it. `originalRole` remains Seeker.

### GET `/games/:gameId/host/roster`

Auth: host. 409 `PHASE_CONFLICT` before the deal.

```json
{
  "gameId": "0f4c…",
  "phase": "ROLE_REVEAL",
  "roundNumber": 1,
  "players": [
    {
      "playerId": "5c1d…",
      "displayName": "Rafi",
      "seatNumber": 4,
      "avatarId": 4,
      "isHost": false,
      "lifeStatus": "ALIVE",
      "originalRoleId": "seeker",
      "originalProfileId": "seeker",
      "originalFaction": "VILLAGE",
      "currentRoleId": "infected_wolf",
      "currentProfileId": "infected_wolf",
      "currentFaction": "WOLF_PACK",
      "wolfAligned": true,
      "abilities": [{ "abilityInstanceId": "ab9…", "abilityId": "infected_kill", "capability": "KILL", "status": "ACTIVE", "usesRemaining": null }]
    }
  ]
}
```

Players are in seat order. A non-host receives 403 `NOT_HOST`.

Both role responses are parsed through their contract schema before they leave the server, so a field the contract does not name is dropped rather than sent.

---

## 5. State and history

### GET `/games/:gameId/state`

Auth: member. Returns the projection for that token: public fields always, player appendix only for the caller, host appendix only for the host.

Public fields: phase, round, timers, seats with name and life status, public events, whether voting is open.

Implemented in WW-501 with the phase fields and the caller's own seat. Public events arrive with `game_events` in Phase 11, and the host appendix with the dashboard (WW-1202). Works in every status, including the lobby.

```json
{
  "gameId": "0f4c…",
  "status": "ACTIVE",
  "phase": "NIGHT_SUBMIT",
  "roundNumber": 1,
  "stateVersion": 21,
  "pacing": "TIMED",
  "phaseStartedAt": "2026-11-11T20:00:00.000Z",
  "phaseEndsAt": "2026-11-11T20:01:30.000Z",
  "serverNow": "2026-11-11T20:00:05.000Z",
  "close": { "next": null, "resolves": "NIGHT" },
  "players": [{ "playerId": "…", "displayName": "Rafi", "seatNumber": 1, "avatarId": 4, "isHost": true, "lifeStatus": "ALIVE" }],
  "you": { "playerId": "…", "isHost": true, "lifeStatus": "ALIVE" }
}
```

- `phaseEndsAt` is null when the host closes the phase. Only timed games set it, and only for night submission, day discussion, and each ballot (OD-43). Role reveal, the day announcement, host confirm, and the reaction window always wait for the host.
- `serverNow` lets a client count down on the server's clock: remaining time is `phaseEndsAt - serverNow`, adjusted for the time since the response arrived.
- `close` says what closing the current phase does: `next` is the phase it moves to, or null when a resolution decides (`resolves` is `NIGHT` or `DAY`). It is null when the phase cannot close. Which night windows open is fixed by the configuration (OD-74), so `close` reveals nothing the configuration did not.

### GET `/games/:gameId/events?afterSeq=120`

Auth: member. Returns events filtered by audience. This is the reconnect catch-up.

### GET `/games/:gameId/tallies`

Auth: member. The public tally of every closed ballot, oldest first (WW-904, OD-85): `{ tallies: [{ roundNumber, ballot, counts: [{ targetPlayerId, total }], abstentions, votedOutPlayerId, tiedPlayerIds }] }`. Totals are weighted (Elder, Mayor) and come from the same tally that decided the ballot. An open ballot is never listed, and no voter id appears. The same body is published as a `VOTE_TALLY` event when the ballot closes.

### GET `/games/:gameId/results`

Auth: member. 409 `PHASE_CONFLICT` unless status is `FINISHED` or `CANCELLED`. Built in WW-903a; the contract is `gameResultsSchema` in `packages/contracts/src/results.ts`.

A finished game returns `{ status: 'FINISHED', roundNumber, winningTeam, draw, seats, infections }`. Each seat has its public fields plus `originalRoleId`, `originalFaction`, `finalRoleId`, `finalFaction`, `lifeStatus`, `death` (`{ roundNumber, phaseKind, roleId }` or null), `won`, `individualWin`, and `abilityUses` (resolved actions). `won` is the winning team by final faction, or an individual win. `infections` lists successful infections only, with source and target. Everything is read from the stored victory, assignment, elimination, and infection rows, so the recap agrees with what ended the game.

A cancelled game returns `{ status: 'CANCELLED', cancelReason, seats }` with public seat fields only: no role, faction, or death, so a cancel is not a way to peek.

Neither shape includes chat (OD-72) or anyone's ballot. A finished recap includes `tallies`, the same public counts as `GET /tallies`.

---

## 6. Night actions

One command covers infection, investigation, protection, poison, tracking, copies, and blocks. Separate URLs would duplicate authorization.

### POST `/games/:gameId/actions`

Auth: the actor. Header `Idempotency-Key`.

```json
{
  "abilityInstanceId": "ab1",
  "targetPlayerIds": ["player-9"],
  "payload": {}
}
```

Response:

```json
{
  "actionId": "act-1",
  "status": "PENDING",
  "abilityInstanceId": "ab1",
  "targetPlayerIds": ["player-9"]
}
```

The response does not echo hidden outcomes. An investigation response does not contain the result. The result arrives as a private event after resolution.

Validation: phase is the ability's window, actor is alive, ability belongs to the actor, charges remain, targets satisfy the ability rule, game version is current.

Errors: 409 wrong phase, dead, duplicate locked action, or no charges. 422 illegal target. 404 ability not found for this player, including abilities the player does not own.

Implemented in WW-601 to WW-603. Details of the shipped route:

- The response also carries `roundNumber`, `phase` (the window the action belongs to: `NIGHT_SUBMIT`, `NIGHT_REACTION`, or `DAY_DISCUSSION`), and `payload`. The request body is strict. `targetPlayerIds` and `payload` default to empty.
- `Idempotency-Key` is required: 8 to 128 letters, digits, or `._:-`. A UUID is ideal. Keys are scoped to the seat as well as the game, so one player cannot replay or block another's request. The same key and body replays the stored response, even after the window has closed. The same key with another body is 409 `IDEMPOTENCY_CONFLICT`. Refusals are not stored, so a refused request can be retried with its key.
- Submitting again for the same ability in the same round replaces the pending choice. The old row stays as `CANCELLED`. Closing the window moves every pending action in it to `LOCKED`, and a later submission is 409 `ACTION_WRONG_PHASE`.
- Abilities that take no player send `targetPlayerIds: []`: the informed Doctor (the server knows the confirmed target), a Seeker's public reveal, and the Spy. The Prophet sends `payload: { "question": "WOLF_PACK_SIZE_AT_LEAST" }`. Free text is never accepted.
- Every check reads only what the actor already knows: the phase, public life status, their own seat, and their own ability. The server never refuses a target because of its role or team. An Alpha may name any living player; an ineligible infection is dropped silently by the resolver. A refusal that said "that player is a wolf" would leak it.

Errors, checked in this order:

| Status | Code | When |
|---|---|---|
| 422 | `VALIDATION_FAILED` | Missing or malformed `Idempotency-Key`, or a body with unknown keys |
| 409 | `IDEMPOTENCY_CONFLICT` | This seat already used the key for a different request |
| 404 | `NOT_FOUND` | The ability does not exist in this game, or is someone else's |
| 409 | `ACTION_NOT_YOUR_ABILITY` | The ability is passive (resolved automatically) or was revoked, for example by infection |
| 409 | `ACTION_DEAD` | The actor is dead |
| 409 | `ACTION_WRONG_PHASE` | Not the ability's window, not yet available (`availableFromRound`, a scheduled copy), or past its round (a night-1-only mark, an expired copy) |
| 409 | `ACTION_NO_CHARGES` | No uses left, or resting after a use (`cooldownNights`) |
| 422 | `ACTION_TARGET_ILLEGAL` | Wrong number of players, a repeat, unknown, dead or alive against the rule, self where not allowed, the Guard's previous-night target, or a payload the ability does not take. `issues` names the field |

### GET `/games/:gameId/me/actions`

Auth: member. The action panel's data: each of the caller's own abilities with `availability` (`OPEN`, or why not: `PASSIVE`, `REVOKED`, `DEAD`, `NOT_THIS_PHASE`, `NOT_YET`, `EXPIRED`, `NO_USES`, `COOLDOWN`) and the caller's pending or locked action for it this round. It uses the same rules as submit, so `OPEN` means a legal submission will be accepted. After a reconnect it restores "Submitted" (OD-55).

### POST `/games/:gameId/host/kill-target`

Auth: host. Phase `NIGHT_HOST_CONFIRM`.

```json
{ "targetPlayerId": "player-9" }
```

The server checks that `player-9` is one of the locked wolf submissions. `{ "noKill": true }` is legal when the host accepts a night with no attack.

Implemented in WW-803. `GET` returns the same view: the candidates (each player and the wolves who named them), the current decision, and `editable` while the phase is host confirm. A target nobody submitted is 422 `KILL_TARGET_NOT_SUBMITTED`. Closing host confirm with no choice is 409 `KILL_TARGET_REQUIRED`. During the reaction window the informed Doctor's save on `GET /me/actions` includes `finalWolfTarget`, or null when the host chose no kill. The client hooks are `useKillTarget` and `useSetKillTarget`. The table picker is WW-803b.

### POST `/games/:gameId/host/resolve-night`

Auth: host. Used when pacing is `HOST` and the current window is the last window before resolution. Timed games resolve from the timer using the same service.

Response: public night summary only.

```json
{
  "round": 2,
  "publicDeaths": [
    { "playerId": "player-4", "displayName": "Rafi", "roleId": "normal_villager" }
  ],
  "gameEnded": false
}
```

Private facts are socket events, not fields on this body. If the caller is the host, the host projection refresh contains the full resolution.

---

## 7. Representative secret flows

### Infection

Same `POST /actions` with the Alpha's infect ability id and one target. There is no public infect route.

After resolution the target receives:

```json
{
  "type": "ROLE_CONVERTED",
  "currentRoleId": "infected_wolf",
  "faction": "WOLF_PACK",
  "text": "Your role is now Infected Wolf. You may choose a kill target on future nights."
}
```

The payload has no `sourcePlayerId`.

### Investigation

`POST /actions` during the night. After resolution:

```json
{
  "type": "INVESTIGATION_RESULT",
  "recordId": "inv-1",
  "round": 2,
  "targetPlayerId": "player-9",
  "result": { "alignment": "WOLF" }
}
```

Audience: that Seeker and the host.

### Public reveal

`POST /actions` during the day with the reveal ability and `payload.recordId`. The server checks the record belongs to the actor and emits a public event containing only that stored result.

### Vote

### POST `/games/:gameId/votes`

```json
{ "targetPlayerId": "player-2" }
```

Abstain with `{ "targetPlayerId": null }`.

Response: `{ "ballot": 1, "targetPlayerId": "player-2", "supersedes": "vote-old" }`

The response does not include other people's votes.

### POST `/games/:gameId/host/voting/close`

Auth: host, or the timer. Tallies, resolves revote or elimination, returns the public result.

```json
{
  "eliminatedPlayerId": "player-2",
  "revealedRoleId": "jester",
  "tied": false,
  "revote": false,
  "winners": [{ "scope": "INDIVIDUAL", "playerId": "player-2", "roleId": "jester" }],
  "gameEnded": false
}
```

A Jester individual win with `gameEnded: false` is the recommended continuation rule.

---

## 8. Host controls

| Method | Route | Effect |
|---|---|---|
| POST | `/games/:gameId/host/phase/close` | Close the current timed or host window early |
| POST | `/games/:gameId/host/kill-target` | Confirm final target |
| POST | `/games/:gameId/host/resolve-night` | Resolve when the phase allows |
| POST | `/games/:gameId/host/voting/close` | Close the ballot |
| POST | `/games/:gameId/players/:playerId/kick` | Lobby only |
| POST | `/games/:gameId/host/transfer` | `{ "playerId" }` lobby or active, audited |
| POST | `/games/:gameId/host/cancel` | End as `CANCELLED` |

There is no route that sets a winner, edits `current_role_id`, or deletes an event.

### POST `/games/:gameId/host/phase/close`

Implemented in WW-501 to WW-503. Auth: host. Body `{ "stateVersion": 21 }`, strict: the version the host's screen shows. The client cannot name the phase it wants; the server's phase machine picks the next one. Response 200: the caller's `GET /state` projection after the close.

The close runs in one transaction under the game row lock. When the phase is the last night window or a ballot, the close runs the night or day resolution inside that transaction (WW-802, WW-901). A night that ends the game finishes it without opening the day (OD-68). A first-ballot tie opens `REVOTE`; a second tie returns to night. If the resolution throws, nothing changes. Until the resolvers land, a night kills nobody and a ballot eliminates nobody.

`resolve-night` and `voting/close` below are later, more specific forms of this close that return the night summary or the tally. All three use the same phase service.

Errors, checked in this order:

| Status | Code | When |
|---|---|---|
| 403 | `NOT_HOST` | The caller is not the host |
| 409 | `PHASE_CONFLICT` | The game is in the lobby, finished, or cancelled |
| 409 | `PHASE_CONFLICT` | `stateVersion` is not the current version: a stale screen, a second click, or the timer got there first |
| 422 | `VALIDATION_FAILED` | The body is missing `stateVersion` or has another key |

Timed phases close themselves at `phaseEndsAt` through the same service. The timer needs no version: every close writes a new deadline or none, so an expired deadline always belongs to the current phase. A host transfer does not move the deadline. On boot the server schedules every open deadline again, and ones that passed while it was down close straight away (OD-57). Host-paced games have no deadline and wait for the host.

### GET `/games/:gameId/host/dashboard`

Auth: host (403 `NOT_HOST` otherwise, 409 before the deal). Built in WW-1202a; the contract is `hostDashboardSchema` in `packages/contracts/src/hostDashboard.ts`.

| Section | Holds |
|---|---|
| `overview` | Status, phase, round, state version, deadline, living seats, living wolf-aligned seats, infection count, cap, and whether infection is sealed |
| `roster` | The same body as `GET /host/roster`: every seat's original and current role, faction, life, and abilities |
| `submissions` | This round's ability uses, night and day, with actor, ability, targets, status, and rejection reason. Replaced choices are left out |
| `infections` | Every attempt, including failures and why |
| `ballots` | Every ballot of the game: each standing vote with its voter and weight, weighted totals per target, and whether it is open. An open ballot uses each voter's current weight |
| `eliminations` | Every death with round, phase, role and faction at death, all causes with contributors, and whether it was revealed |
| `victory` | The outcome once finished, and every decided individual victory |

Pending wolf targets are inside this payload and nowhere else.

---

## 9. Realtime events

Namespace `/play`. Connection query or handshake auth carries the bearer token. The server joins:

- `game:{gameId}:public` for every member.
- `game:{gameId}:player:{playerId}` for that player.
- `game:{gameId}:host` for the host.

| Event | Audience | Payload contains |
|---|---|---|
| `PLAYER_JOINED` | Public | Name, seat, count |
| `PLAYER_LEFT` | Public | Seat, lobby only |
| `CONFIGURATION_UPDATED` | Public in lobby | Summary counts and validity |
| `GAME_STARTED` | Public | Phase, round. No roles |
| `ROLE_ASSIGNED` | Player | Own role payload |
| `HOST_ROSTER_READY` | Host | Full roster |
| `NIGHT_STARTED` | Public | Round, and a per-player `ACTION_REQUIRED` |
| `ACTION_REQUIRED` | Player | Ability prompts, no recommended target |
| `ACTION_SUBMITTED` | Player and host | Acknowledgement. Host copy includes the target. Player copy does not include other actors |
| `KILL_TARGET_REQUIRED` | Host | The set of submitted target ids |
| `DOCTOR_PROMPT` | Doctor and host | The final target id |
| `INFECTION_OCCURRED` | Converted player and host | New role. No source id on the player copy. Host copy includes source and target |
| `ROLE_CONVERTED` | That player and host | New role and revoked abilities |
| `INVESTIGATION_RESULT` | Actor and host | The fact |
| `PLAYER_ELIMINATED` | Public | Seat, and role id only if reveal is on |
| `DAY_STARTED` | Public | Public night facts |
| `VOTING_STARTED` | Public | Eligible seats |
| `VOTE_CAST` | Voter and host | That vote |
| `VOTING_COMPLETED` | Public | Tally and elimination |
| `REVOTE_STARTED` | Public | The tied seats |
| `GAME_COMPLETED` | Public | Winners and recap pointer |
| `GAME_CANCELLED` | Public | Reason `HOST` or `SURRENDER` |
| `PHASE_CHANGED` | Public | The new phase, round, and state version. No roles |
| `VOTE_TALLY` | Public | A closed ballot's counts per target, abstentions, the named player, and any tie (OD-85). No voter ids |
| `STATE_SNAPSHOT` | The requesting socket | The same projection as GET state |
| `CHAT_MESSAGE_POSTED` | Public | The message, as in section 13. Not stored in `game_events`, no event `seq` |
| `CHAT_MESSAGE_DELETED` | Public | `{ messageId }` |
| `CHAT_SEAT_MUTED` | Public | `{ playerId }` |
| `CHAT_SEAT_UNMUTED` | Public | `{ playerId }` |

The host copy and the player copy of a secret event are two `game_events` rows. Do not emit one rich payload to a shared room. Night result rows are written after the night transaction commits, from the stored investigation, infection, conversion, elimination, and block rows (WW-804). A successful infection's player row is `{ roundNumber, actionId, roleId }` with no source. The host row adds `sourcePlayerId` and `targetPlayerId`. A failed infection is not an event. A public death includes `roleId` only when the elimination was revealed. A block is told to its target only when `informTarget` is set, and that copy is `{ roundNumber }`.

`join-session` is how a connected socket enters `game:{gameId}:public`, its own `player` room, and `host` when that seat is the host (WW-1101). The payload's `playerId` is ignored. A token from another game is refused and joins nothing. The server ignores client-originated `ROLE_ASSIGNED`, `INFECTION_OCCURRED`, `ROLE_CONVERTED`, `INVESTIGATION_RESULT`, and `PLAYER_ELIMINATED`. Clients emit `join-session` and send commands over HTTP. After the night rows commit, each row is emitted to its room. `join-session` takes `afterSeq` and replays newer rows the seat may see. `GET /games/:gameId/events?afterSeq` is the same list (WW-1102).

---

## 10. Authorization matrix for common mistakes

| Attempt | Result |
|---|---|
| Player reads `/host/roster` | 403 |
| Player reads another seat's `/me` | No such route. `/me` is the token's seat |
| Player submits another player's ability id | 404 |
| Dead player votes | 409 `VOTE_INELIGIBLE` |
| Villager submits at night | 409 `ACTION_NOT_YOUR_ABILITY` |
| Alpha infects after death | 409 |
| Second resolver | 409 `PHASE_CONFLICT` |
| Replay of the same idempotency key and body | Original 200 |
| Same key, different body | 409 `IDEMPOTENCY_CONFLICT` |
| Member guesses a sequential game id | 404 if the token is not in that game |
| Post chat at night or on the reveal | 409 `CHAT_CLOSED` |
| Dead player posts chat | 403 `CHAT_READ_ONLY` |
| Muted seat posts chat | 403 `CHAT_MUTED` |
| Player deletes a message or mutes a seat | 403 `NOT_HOST` |

---

### Host route audit (WW-1303, 12 November 2026)

The audit is a test, `apps/api/test/host-routes.integration.test.ts`, so it fails when a route is added without a decision about who may call it.

- **Inventory.** Every mounted route is classified as public (health, readiness, version, catalog), entry (create, join), member (any seat in the game), or host. A route that is mounted but not classified, or classified but not mounted, fails the test. Every path under `/host/` must be a host route.
- **Host routes (13):** kick, host transfer, cancel, save and validate configuration, start, host roster, phase close, kill target (read and set), dashboard, delete a chat message, mute, unmute. Each returns 401 without a token, 404 for a token from another game, and 403 `NOT_HOST` for a guest. The host check runs before any state check. A guest who sends a malformed body gets 422 first; that reveals nothing.
- **Member routes** return 401 without a token and 404 for another game's token. Public routes answer without a token.
- **No route writes a role or a winner.** A source scan allows writes to `role_assignments` only in the assignment repository, the night resolution, and the victory evaluator, and writes to `victory_records` and `games.winner_summary` only in the victory evaluator. No controller file contains such a write. Every host write body is strict: a smuggled `winner`, `roleId`, or `assignments` field is 422. The setup cannot change after the deal (409 `GAME_STARTED`).
- **Host-only events** never reach a guest's `/events`.

**Findings and fixes.**

1. After a host transfer during a game, the old host's open socket stayed in `game:{id}:host` and kept receiving host-only events, and the new host received none until reconnecting. The transfer now moves the sockets between rooms after commit, and `join-session` re-reads the seat instead of trusting the connect-time copy. Covered by `apps/api/test/host-transfer-socket.integration.test.ts`, which fails without the fix.
2. `POST /host/transfer` accepted and silently dropped unknown fields. Its body is now strict, like every other host write.

## 11. Local development notes

The HTTP API and the socket server run in one process in version 1 so a game lock and the following emit share one deployment unit. The emit happens after commit. If the process dies after commit and before emit, reconnect catch-up reads `game_events` and no fact is lost.

## 12. Ultimate 20 submissions

`POST /games/:gameId/actions` accepts the new capabilities on the same body. A Ghost hint sends `payload.hint`, already trimmed, 1 to 140 characters. A name or a seat number is `422` with `TEXT_NAMES_PLAYER`. The wrong length is `TEXT_LENGTH`.

An ability with `exclusiveGroup` cancels the caller's other pending choice in that group for this round. Ultimate Alpha kill and infect share `alpha_choice`, so submitting one replaces the other. Vampire kill and mark, and the Servant's copies, share `vampire_choice`. The team still resolves only one of them: the Vampire's submission wins, otherwise the lowest player id.

`GET /me` lists living Vampire-team teammates for a Vampire or a Servant. A marked player is not told, and is not listed. A promotion event names the Vampire only on the Servant's copy, the other team members' copies, and the host copy.

`GET /me` includes `exclusiveGroup` on an ability when the definition sets it. A `TEXT` target is `{ kind: 'TEXT', maxLength }`.

Creating a game with `mode: 'ULTIMATE_20'` stores the `ultimate-20` pack. Start needs `acknowledgeWarnings: true` because the pack carries warnings. A locked edit is reported as `MODE_RULE_LOCKED` on the configuration validation, and the draft is still stored.

## 13. Table chat

WW-1104, under the OD-72 rules. One public channel per game. Every seat reads it. Only a living, unmuted seat posts, and only in `DAY_DISCUSSION`, `VOTING`, and `REVOTE`. There is no wolf channel and no dead channel. Messages and mutes are deleted when the game finishes or is cancelled, and the recap does not show them. The rule is `chatRefusal` in `@warewolf/domain`, so the client composer reads the same rule as the server.

### GET `/games/:gameId/chat`

Any seat in the game.

```json
{
  "messages": [
    { "messageId": "uuid", "seq": 41, "playerId": "uuid", "body": "I trust seat 3.", "roundNumber": 2, "phase": "DAY_DISCUSSION", "createdAt": "2026-11-11T10:00:00.000Z" }
  ],
  "mutedPlayerIds": ["uuid"],
  "you": { "canPost": true, "refusal": null }
}
```

Oldest first. `refusal` is `CLOSED`, `DEAD`, `MUTED`, or null. A reconnecting client reads this again instead of replaying socket events, so a deletion it missed is not shown.

### POST `/games/:gameId/chat/messages`

Body `{ "body": "text" }`. The text is trimmed, Windows line ends become `\n`, and the trimmed text is stored. Returns 201 with the message, and emits `CHAT_MESSAGE_POSTED` to the public room after commit.

Checked in this order:

1. Blank text, a control character other than a line break or tab, or more than 280 code points: 422 `VALIDATION_FAILED`.
2. More than 5 attempts by this seat in 10 seconds: 429 `RATE_LIMITED`. Every attempt that passes step 1 counts, including a refused one. The budget is in memory, per process.
3. Under a shared lock on the game row, so a phase close cannot commit between the check and the insert: chat not open 409 `CHAT_CLOSED`, dead 403 `CHAT_READ_ONLY`, muted 403 `CHAT_MUTED`.

### DELETE `/games/:gameId/chat/messages/:messageId`

Host only (403 `NOT_HOST`). 204. A message that does not exist in this game is 404. Emits `CHAT_MESSAGE_DELETED`.

### PUT and DELETE `/games/:gameId/chat/mutes/:playerId`

Host only (403 `NOT_HOST`), while the game is `ACTIVE` (409 `PHASE_CONFLICT`). PUT mutes and DELETE unmutes. 204. The host's own seat is 422, and a seat from another game is 404. Repeating a mute or an unmute changes nothing and emits nothing. Otherwise emits `CHAT_SEAT_MUTED` or `CHAT_SEAT_UNMUTED`. Mutes are public in `mutedPlayerIds`: a muted seat's silence is visible at the table anyway.
