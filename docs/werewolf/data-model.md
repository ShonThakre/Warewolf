# Data Model

PostgreSQL is the system of record. The domain package uses plain objects. The API adapter maps those objects with Drizzle. Redis is not required for correctness. A single API node can hold sockets in memory. A later multi-node deployment can add a Socket.IO Redis adapter without moving game state out of PostgreSQL.

The catalog of role definitions lives in code. Each game stores the catalog hash and a frozen configuration snapshot so a future catalog edit does not rewrite an active game.

---

## 1. Ownership

`games` is the aggregate root. Every other gameplay row carries `game_id` and is deleted only when a finished game is archived by an explicit retention job. Child rows are not edited in ways that hide history.

| Entity | Owned by | Mutability |
|---|---|---|
| Game | Room | Phase and version change. Snapshot does not |
| Game player | Game | Life status and connection change |
| Role assignment | Player in a game | Current role and faction change. Originals do not |
| Ability instance | Assignment | Charges and status change |
| Round / phase history | Game | Append only |
| Night action | Round and ability | Pending row may be replaced until lock, then status only moves forward |
| Vote | Ballot | New row supersedes the old one |
| Infection, elimination, investigation, conversion | Game | Append only |
| Game event | Game | Append only |
| Resolution run | Round | One row, insert only |
| Victory record | Game | Insert, or status update from pending to revoked |

---

## 2. Identity and concurrency

- Primary keys are UUIDs, except `game_events.seq`, which is a per-game increasing integer.
- `games.state_version` increments on every committed transition.
- Transitions use `UPDATE ... WHERE id = $id AND state_version = $expected`.
- Night and day resolution also `SELECT ... FOR UPDATE` on the game row.
- `resolution_runs` has a unique `(game_id, round_number, phase_kind)`.
- Night actions have a unique `(game_id, round_number, ability_instance_id)` while status is pending or locked.
- Clients send `Idempotency-Key`. The unique `(game_id, idempotency_key)` returns the stored response.

---

## 3. Tables

### games

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| room_code | text | 6 characters from an unambiguous alphabet |
| status | text | `LOBBY`, `ACTIVE`, `FINISHED`, `CANCELLED` |
| phase | text | See phase list below |
| round_number | int | Starts at 1 when the game starts |
| state_version | int | Starts at 0 |
| host_player_id | uuid | |
| mode | text | |
| config_snapshot | jsonb | Frozen at start. Lobby draft lives in `config_draft` |
| config_draft | jsonb | Editable only in lobby |
| catalog_hash | text | |
| phase_started_at | timestamptz | |
| phase_ends_at | timestamptz null | Null when host-paced |
| winner_summary | jsonb null | Filled at end |
| created_at / updated_at | timestamptz | |

Indexes:

- Unique `room_code` where status in (`LOBBY`, `ACTIVE`).
- Index `(status, phase)` for recovery scans.

Phases: `LOBBY`, `ROLE_REVEAL`, `NIGHT_SUBMIT`, `NIGHT_HOST_CONFIRM`, `NIGHT_REACTION`, `DAY_ANNOUNCE`, `DAY_DISCUSSION`, `VOTING`, `REVOTE`, `FINISHED`, `CANCELLED`.

Resolution itself is a transaction inside the closing of `NIGHT_REACTION` or `NIGHT_SUBMIT`, and inside the closing of `VOTING` or `REVOTE`. It is not a phase clients linger in.

### game_players

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| game_id | uuid fk | |
| display_name | text | Unique per game |
| seat_number | int | Unique per game |
| is_host | boolean | |
| life_status | text | `ALIVE`, `DEAD` |
| connection_status | text | `CONNECTED`, `DISCONNECTED` |
| token_hash | text | SHA-256 of the bearer token. The raw token is shown once |
| died_round | int null | |
| created_at | timestamptz | |

### role_assignments

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| game_id | uuid | |
| player_id | uuid unique | One assignment per player |
| original_role_id | text | Immutable |
| current_role_id | text | |
| original_faction | text | Immutable |
| current_faction | text | |
| wolf_aligned | boolean | |
| individual_victory | text | `NONE`, `ACHIEVED`, `FAILED`, `REVOKED` |
| public_reveal | boolean | |
| mark_target_player_id | uuid null | Assassin mark |

### ability_instances

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| game_id | uuid | |
| player_id | uuid | |
| assignment_id | uuid | |
| ability_id | text | |
| capability | text | |
| handler_key | text null | |
| status | text | `ACTIVE`, `REVOKED`, `EXHAUSTED`, `SCHEDULED` |
| charges_remaining | int null | Null means unlimited |
| uses_consumed | int | |
| last_used_round | int null | |
| last_target_player_id | uuid null | Supports Guard's consecutive rule |
| available_from_round | int | |
| expires_round | int null | Shapeshifter copies |
| source | text | `NATIVE`, `COPY`, `INHERITED` |
| source_player_id | uuid null | |
| config | jsonb | Frozen ability profile |
| revoked_reason | text null | |

Unique `(assignment_id, ability_id, source)` for native rows.

### night_actions

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| game_id | uuid | |
| round_number | int | |
| player_id | uuid | |
| ability_instance_id | uuid | |
| target_player_ids | uuid[] | |
| payload | jsonb | |
| status | text | `PENDING`, `LOCKED`, `RESOLVED`, `REJECTED`, `CANCELLED` |
| idempotency_key | text | |
| submitted_at | timestamptz | |

Unique `(game_id, idempotency_key)`.

Unique `(game_id, round_number, ability_instance_id)`.

### votes

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| game_id | uuid | |
| round_number | int | |
| ballot | int | 1 for the first vote, 2 for the revote |
| voter_player_id | uuid | |
| target_player_id | uuid null | Null abstains |
| weight | int | Copied from the modifier state at close, not at submit, so a modifier expiring mid-ballot is deterministic. Recommended: compute weight at close |
| superseded | boolean | |
| submitted_at | timestamptz | |

Index `(game_id, round_number, ballot, voter_player_id, superseded)`.

### infection_records

| Column | Type |
|---|---|
| id | uuid |
| game_id | uuid |
| round_number | int |
| source_player_id | uuid |
| target_player_id | uuid |
| previous_role_id | text |
| outcome | text |
| failure_reason | text null |
| created_at | timestamptz |

### investigation_records

| Column | Type |
|---|---|
| id | uuid |
| game_id | uuid |
| round_number | int |
| actor_player_id | uuid |
| ability_id | text |
| target_player_ids | uuid[] |
| result | jsonb |
| published | boolean |

`result` is the private fact. Publication copies it into a public event. The private row stays.

### elimination_records

| Column | Type |
|---|---|
| id | uuid |
| game_id | uuid |
| round_number | int |
| phase_kind | text | `NIGHT` or `DAY` |
| player_id | uuid |
| role_at_death | text |
| original_role_id | text |
| faction_at_death | text |
| causes | jsonb | Ordered cause objects |
| revealed_publicly | boolean |

### role_conversion_records

| Column | Type |
|---|---|
| id | uuid |
| game_id | uuid |
| round_number | int |
| player_id | uuid |
| from_role_id | text |
| to_role_id | text |
| from_faction | text |
| to_faction | text |
| reason | text | `INFECTION`, `CURSED`, `INHERIT`, `COPY_GRANT`, `COPY_EXPIRE` |

### victory_records

| Column | Type |
|---|---|
| id | uuid |
| game_id | uuid |
| round_number | int |
| scope | text | `TEAM` or `INDIVIDUAL` |
| faction | text null |
| player_id | uuid null |
| role_id | text null |
| outcome | text | `WIN`, `DRAW` |
| terminal | boolean |

### game_events

| Column | Type |
|---|---|
| game_id | uuid |
| seq | bigint | Unique with game_id |
| type | text |
| audience | text | `PUBLIC`, `HOST`, `PLAYER` |
| recipient_player_id | uuid null |
| payload | jsonb |
| created_at | timestamptz |

Primary key `(game_id, seq)`. Index `(game_id, audience, recipient_player_id, seq)`.

Clients reconnect with `afterSeq` and receive only rows their token may see.

### resolution_runs

| Column | Type |
|---|---|
| id | uuid |
| game_id | uuid |
| round_number | int |
| phase_kind | text |
| input_hash | text |
| result | jsonb |
| created_at | timestamptz |

Unique `(game_id, round_number, phase_kind)`.

### idempotency_keys

| Column | Type |
|---|---|
| game_id | uuid |
| key | text |
| request_hash | text |
| response | jsonb |
| created_at | timestamptz |

Unique `(game_id, key)`. The same key with a different request hash returns 409.

---

## 4. Relationships

```mermaid
erDiagram
  games ||--o{ game_players : seats
  games ||--|| role_snapshot : freezes
  games ||--o{ role_assignments : deals
  game_players ||--|| role_assignments : has
  role_assignments ||--o{ ability_instances : grants
  games ||--o{ night_actions : collects
  ability_instances ||--o{ night_actions : submits
  games ||--o{ votes : ballots
  game_players ||--o{ votes : casts
  games ||--o{ infection_records : converts
  games ||--o{ investigation_records : informs
  games ||--o{ elimination_records : removes
  games ||--o{ role_conversion_records : rewrites
  games ||--o{ victory_records : ends
  games ||--o{ game_events : publishes
  games ||--o{ resolution_runs : commits
```

`role_snapshot` in the diagram is `games.config_snapshot` plus `catalog_hash`, not a second catalog table.

---

## 5. Recovery

On process start:

1. Load games with status `ACTIVE`.
2. For timed games with `phase_ends_at` in the past, enqueue the same transition the timer would have run.
3. For host-paced games, leave the phase and wait.
4. Do not recompute a round that already has a `resolution_run`.
5. Clients present the player token, receive the projection for their audience, and pass `afterSeq`.

Connection status is advisory. Authority is the token and the rows.

---

## 6. Retention and privacy

- Raw bearer tokens are never stored.
- `game_events.payload` for `PLAYER` audience must already be the filtered fact. Do not store a public copy of a secret and filter only at read time. Write the audience-specific payload.
- Host payloads can contain secrets and are selected only for the host token.
- After `FINISHED`, the recap projection may include original roles for every seat. The recap is a new public event written at game end, not a widening of old private events.
- Logs outside PostgreSQL must use ids, not role names, at info level.

---

## 7. Assignment algorithm persistence

The dealer shuffles a multiset of role ids with a CSPRNG and writes assignments inside the start transaction. The seed is not stored. The assignment rows are the record. Tests inject a shuffle function. Production does not accept a client-supplied seed.
