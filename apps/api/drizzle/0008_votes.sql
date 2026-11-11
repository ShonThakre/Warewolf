CREATE TABLE "victory_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"faction" text,
	"player_id" uuid,
	"role_id" text,
	"outcome" text NOT NULL,
	"terminal" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "victory_records_scope_ck" CHECK (scope in ('TEAM', 'INDIVIDUAL')),
	CONSTRAINT "victory_records_outcome_ck" CHECK (outcome in ('WIN', 'DRAW')),
	CONSTRAINT "victory_records_faction_ck" CHECK (faction is null or faction in ('VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT'))
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"ballot" integer NOT NULL,
	"voter_player_id" uuid NOT NULL,
	"target_player_id" uuid,
	"weight" integer DEFAULT 1 NOT NULL,
	"superseded" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_ballot_ck" CHECK (ballot in (1, 2)),
	CONSTRAINT "votes_round_ck" CHECK (round_number >= 1),
	CONSTRAINT "votes_weight_ck" CHECK (weight >= 0)
);
--> statement-breakpoint
ALTER TABLE "victory_records" ADD CONSTRAINT "victory_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "victory_records" ADD CONSTRAINT "victory_records_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_player_id_game_players_id_fk" FOREIGN KEY ("voter_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_target_player_id_game_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "victory_records_game_idx" ON "victory_records" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_active_uq" ON "votes" USING btree ("game_id","round_number","ballot","voter_player_id") WHERE superseded = false;--> statement-breakpoint
CREATE INDEX "votes_ballot_idx" ON "votes" USING btree ("game_id","round_number","ballot");--> statement-breakpoint
ALTER TABLE "scheduled_effects" DROP CONSTRAINT "scheduled_effects_attack_types_ck";--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_attack_types_ck" CHECK (attack_types <@ array['WOLF_KILL', 'SNIPER', 'POISON', 'REVENGE', 'DAY_VOTE']::text[]);--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "games_mode_ck";--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_mode_ck" CHECK (mode in ('INFECTION', 'CLASSIC', 'EXPANDED', 'CUSTOM', 'ULTIMATE_20'));--> statement-breakpoint
ALTER TABLE "ability_instances" DROP CONSTRAINT "ability_instances_capability_ck";--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_capability_ck" CHECK (capability in ('INVESTIGATE', 'PROTECT', 'HEAL', 'KILL', 'POISON', 'INFECT', 'BLOCK_ACTION', 'TRACK', 'DETECT', 'ROLE_COPY', 'ROLE_REVEAL', 'VOTE_MODIFIER', 'SURVIVE_DEATH', 'REVENGE', 'COMMUNICATE_WITH_DEAD', 'MODIFY_VOTING', 'TEAM_SUPPORT', 'CONVERT', 'REWIND', 'SILENCE', 'REVIVE', 'HINT', 'CHAOS'));--> statement-breakpoint
ALTER TABLE "night_actions" DROP CONSTRAINT "night_actions_rejected_reason_ck";--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_rejected_reason_ck" CHECK (rejected_reason in ('ABILITY_UNAVAILABLE', 'WRONG_PHASE', 'TARGET_ILLEGAL', 'BLOCKED', 'NOT_IMPLEMENTED', 'SUPERSEDED', 'REWOUND'));--> statement-breakpoint
ALTER TABLE "investigation_records" DROP CONSTRAINT "investigation_records_kind_ck";--> statement-breakpoint
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_kind_ck" CHECK (kind in ('ALIGNMENT_WOLF_OR_NOT', 'ROLE_CATEGORY', 'ROLE_ID', 'SAME_OR_DIFFERENT_FACTION', 'ROLE_AT_DEATH', 'VISITED_PLAYER_IDS', 'YES_NO', 'WOLF_KILL_SUBMISSION_COUNT', 'ATTACKER_IDS', 'FACTION'));--> statement-breakpoint
ALTER TABLE "role_conversion_records" DROP CONSTRAINT "role_conversion_records_reason_ck";--> statement-breakpoint
ALTER TABLE "role_conversion_records" ADD CONSTRAINT "role_conversion_records_reason_ck" CHECK (reason in ('INFECTION', 'CURSED', 'VAMPIRE', 'INHERIT', 'COPY_GRANT', 'COPY_EXPIRE'));--> statement-breakpoint
ALTER TABLE "scheduled_effects" DROP CONSTRAINT "scheduled_effects_kind_ck";--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_kind_ck" CHECK (kind in ('SHIELD', 'POISON', 'REVENGE', 'VAMPIRE_MARK', 'RETURNED', 'CHAOS_DAY'));