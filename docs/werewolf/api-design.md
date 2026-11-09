# API Design

Base path: `/api/v1`.

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

Stable codes include: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `ROOM_FULL`, `GAME_STARTED`, `DISPLAY_NAME_TAKEN`, `CONFIG_INVALID`, `ACTION_WRONG_PHASE`, `ACTION_DEAD`, `ACTION_NOT_YOUR_ABILITY`, `ACTION_NO_CHARGES`, `ACTION_TARGET_ILLEGAL`, `ACTION_DUPLICATE`, `VOTE_INELIGIBLE`, `NOT_HOST`, `PHASE_CONFLICT`, `IDEMPOTENCY_CONFLICT`.

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

Errors: 404 unknown code, 409 room full or started, 409 name taken.

### GET `/games/:gameId`

Auth: member.

Response: lobby projection. Players see seat names, host id, mode name, player count, and their own seat. They do not see the full draft if the product decision is to hide the wolf count before start. **Recommendation:** before start, every member may see the configuration summary, because the host is configuring in front of the table. Secret roles do not exist yet. After start, this endpoint returns the public game projection only.

### POST `/games/:gameId/leave`

Auth: member. Lobby only. Host leave cancels the room, or transfers host if a `hostPlayerId` is included. Recommended default: host leave in lobby cancels.

### POST `/games/:gameId/start`

Auth: host. Lobby only. Body: `{ "acknowledgeWarnings": true }`

The server validates again, deals roles, writes assignments, moves to `ROLE_REVEAL`, and emits events.

Errors: 422 configuration, 409 seat count mismatch, 409 already started.

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

Auth: player.

```json
{
  "playerId": "5c1d",
  "lifeStatus": "ALIVE",
  "originalRole": { "id": "seeker", "name": "Seeker", "faction": "VILLAGE" },
  "currentRole": { "id": "seeker", "name": "Seeker", "faction": "VILLAGE" },
  "abilities": [
    {
      "abilityInstanceId": "ab1",
      "capability": "INVESTIGATE",
      "usesRemaining": null,
      "available": true,
      "prompt": "Choose one living player to investigate."
    }
  ],
  "teammates": [],
  "privateNotes": []
}
```

After infection, `currentRole` becomes Infected Wolf and `abilities` lists the kill action only when the round allows it. `originalRole` remains Seeker.

### GET `/games/:gameId/host/roster`

Auth: host.

```json
{
  "players": [
    {
      "playerId": "5c1d",
      "displayName": "Rafi",
      "lifeStatus": "ALIVE",
      "originalRoleId": "seeker",
      "currentRoleId": "infected_wolf",
      "originalFaction": "VILLAGE",
      "currentFaction": "WOLF_PACK",
      "abilities": [{ "abilityId": "infected_kill", "status": "ACTIVE" }]
    }
  ]
}
```

A non-host receives 403.

---

## 5. State and history

### GET `/games/:gameId/state`

Auth: member. Returns the projection for that token: public fields always, player appendix only for the caller, host appendix only for the host.

Public fields: phase, round, timers, seats with name and life status, public events, whether voting is open.

### GET `/games/:gameId/events?afterSeq=120`

Auth: member. Returns events filtered by audience. This is the reconnect catch-up.

### GET `/games/:gameId/results`

Auth: member. 409 unless status is `FINISHED` or `CANCELLED`. Finished games return the recap: original roles, final roles, infections, eliminations, ability counts, winners. Cancelled games return seats and the cancel reason without revealing roles. Recommended, so a cancel is not a way to peek.

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

### POST `/games/:gameId/host/kill-target`

Auth: host. Phase `NIGHT_HOST_CONFIRM`.

```json
{ "targetPlayerId": "player-9" }
```

The server checks that `player-9` is one of the locked wolf submissions. `{ "noKill": true }` is legal when the host accepts a night with no attack.

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

### GET `/games/:gameId/host/dashboard`

Auth: host. One payload for the dashboard: roster, pending actions, submissions, infection log, vote tally including open ballots, eliminations, victory flags, phase.

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
| `STATE_SNAPSHOT` | The requesting socket | The same projection as GET state |

The host copy and the player copy of a secret event are two `game_events` rows, or one row with audience `PLAYER` plus a separate host row. Do not emit one rich payload to a shared room.

Socket rate limits follow the HTTP limits. A client cannot emit a trusted `ROLE_ASSIGNED` or `INFECTION_OCCURRED`. The server ignores client-originated game events. Clients only emit `join-session` and may use HTTP for commands. Recommended: commands stay on HTTP so idempotency and validation live in one place. Sockets are server-to-client.

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

---

## 11. Local development notes

The HTTP API and the socket server run in one process in version 1 so a game lock and the following emit share one deployment unit. The emit happens after commit. If the process dies after commit and before emit, reconnect catch-up reads `game_events` and no fact is lost.
