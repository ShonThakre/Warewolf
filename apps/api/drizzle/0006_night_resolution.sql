CREATE TABLE "elimination_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"phase_kind" text NOT NULL,
	"player_id" uuid NOT NULL,
	"role_at_death" text NOT NULL,
	"original_role_id" text NOT NULL,
	"faction_at_death" text NOT NULL,
	"causes" jsonb NOT NULL,
	"revealed_publicly" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "elimination_records_phase_kind_ck" CHECK (phase_kind in ('NIGHT', 'DAY')),
	CONSTRAINT "elimination_records_faction_ck" CHECK (faction_at_death in ('VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT'))
);
--> statement-breakpoint
CREATE TABLE "infection_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"action_id" uuid,
	"source_player_id" uuid NOT NULL,
	"target_player_id" uuid NOT NULL,
	"previous_role_id" text NOT NULL,
	"outcome" text NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "infection_records_outcome_ck" CHECK (outcome in ('SUCCESS', 'FAILED')),
	CONSTRAINT "infection_records_failure_reason_ck" CHECK (failure_reason in ('ALPHA_DEAD', 'CAP_SUCCESS', 'CAP_SIZE', 'TARGET_DEAD', 'TARGET_INELIGIBLE', 'BLOCKED', 'SEALED', 'DISABLED')),
	CONSTRAINT "infection_records_reason_ck" CHECK ((outcome = 'SUCCESS') = (failure_reason is null))
);
--> statement-breakpoint
CREATE TABLE "investigation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"action_id" uuid NOT NULL,
	"actor_player_id" uuid NOT NULL,
	"ability_instance_id" uuid NOT NULL,
	"ability_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_player_ids" uuid[] NOT NULL,
	"result" jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investigation_records_kind_ck" CHECK (kind in ('ALIGNMENT_WOLF_OR_NOT', 'ROLE_CATEGORY', 'ROLE_ID', 'SAME_OR_DIFFERENT_FACTION', 'ROLE_AT_DEATH', 'VISITED_PLAYER_IDS', 'YES_NO', 'WOLF_KILL_SUBMISSION_COUNT', 'ATTACKER_IDS'))
);
--> statement-breakpoint
CREATE TABLE "resolution_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"phase_kind" text NOT NULL,
	"input_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resolution_runs_phase_kind_ck" CHECK (phase_kind in ('NIGHT', 'DAY')),
	CONSTRAINT "resolution_runs_round_ck" CHECK (round_number >= 1)
);
--> statement-breakpoint
CREATE TABLE "role_conversion_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"player_id" uuid NOT NULL,
	"from_role_id" text NOT NULL,
	"to_role_id" text NOT NULL,
	"from_faction" text NOT NULL,
	"to_faction" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_conversion_records_reason_ck" CHECK (reason in ('INFECTION', 'CURSED', 'INHERIT', 'COPY_GRANT', 'COPY_EXPIRE')),
	CONSTRAINT "role_conversion_records_from_faction_ck" CHECK (from_faction in ('VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT')),
	CONSTRAINT "role_conversion_records_to_faction_ck" CHECK (to_faction in ('VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT'))
);
--> statement-breakpoint
CREATE TABLE "scheduled_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_player_id" uuid NOT NULL,
	"source_ability_instance_id" uuid NOT NULL,
	"target_player_id" uuid NOT NULL,
	"created_round" integer NOT NULL,
	"due_round" integer,
	"due_phase" text,
	"attack_types" text[] NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"closed_round" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_effects_kind_ck" CHECK (kind in ('SHIELD', 'POISON', 'REVENGE')),
	CONSTRAINT "scheduled_effects_status_ck" CHECK (status in ('ACTIVE', 'SPENT', 'EXPIRED')),
	CONSTRAINT "scheduled_effects_due_phase_ck" CHECK (due_phase in ('NIGHT', 'DAY')),
	CONSTRAINT "scheduled_effects_attack_types_ck" CHECK (attack_types <@ array['WOLF_KILL', 'SNIPER', 'POISON', 'REVENGE']::text[]),
	CONSTRAINT "scheduled_effects_due_ck" CHECK ((due_round is null) = (due_phase is null)),
	CONSTRAINT "scheduled_effects_closed_ck" CHECK ((status = 'ACTIVE') = (closed_round is null))
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "infection_successes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "infection_sealed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "night_actions" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
ALTER TABLE "elimination_records" ADD CONSTRAINT "elimination_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elimination_records" ADD CONSTRAINT "elimination_records_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infection_records" ADD CONSTRAINT "infection_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infection_records" ADD CONSTRAINT "infection_records_action_id_night_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."night_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infection_records" ADD CONSTRAINT "infection_records_source_player_id_game_players_id_fk" FOREIGN KEY ("source_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "infection_records" ADD CONSTRAINT "infection_records_target_player_id_game_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_action_id_night_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."night_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_actor_player_id_game_players_id_fk" FOREIGN KEY ("actor_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_ability_instance_id_ability_instances_id_fk" FOREIGN KEY ("ability_instance_id") REFERENCES "public"."ability_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_runs" ADD CONSTRAINT "resolution_runs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_conversion_records" ADD CONSTRAINT "role_conversion_records_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_conversion_records" ADD CONSTRAINT "role_conversion_records_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_source_player_id_game_players_id_fk" FOREIGN KEY ("source_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_source_ability_instance_id_ability_instances_id_fk" FOREIGN KEY ("source_ability_instance_id") REFERENCES "public"."ability_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_target_player_id_game_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "elimination_records_player_uq" ON "elimination_records" USING btree ("game_id","player_id");--> statement-breakpoint
CREATE INDEX "infection_records_game_idx" ON "infection_records" USING btree ("game_id","round_number");--> statement-breakpoint
CREATE UNIQUE INDEX "investigation_records_action_uq" ON "investigation_records" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "investigation_records_actor_idx" ON "investigation_records" USING btree ("game_id","actor_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resolution_runs_round_uq" ON "resolution_runs" USING btree ("game_id","round_number","phase_kind");--> statement-breakpoint
CREATE INDEX "role_conversion_records_game_idx" ON "role_conversion_records" USING btree ("game_id","round_number");--> statement-breakpoint
CREATE INDEX "scheduled_effects_open_idx" ON "scheduled_effects" USING btree ("game_id") WHERE status = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_infection_successes_ck" CHECK (infection_successes >= 0);--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_rejected_reason_ck" CHECK (rejected_reason in ('ABILITY_UNAVAILABLE', 'WRONG_PHASE', 'TARGET_ILLEGAL', 'BLOCKED', 'NOT_IMPLEMENTED'));--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_rejected_status_ck" CHECK (rejected_reason is null or status = 'REJECTED');