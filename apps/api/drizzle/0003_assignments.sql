CREATE TABLE "ability_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"ability_id" text NOT NULL,
	"capability" text,
	"handler_key" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"charges_remaining" integer,
	"uses_consumed" integer DEFAULT 0 NOT NULL,
	"last_used_round" integer,
	"last_target_player_id" uuid,
	"available_from_round" integer NOT NULL,
	"expires_round" integer,
	"source" text DEFAULT 'NATIVE' NOT NULL,
	"source_player_id" uuid,
	"config" jsonb NOT NULL,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ability_instances_capability_ck" CHECK (capability in ('INVESTIGATE', 'PROTECT', 'HEAL', 'KILL', 'POISON', 'INFECT', 'BLOCK_ACTION', 'TRACK', 'DETECT', 'ROLE_COPY', 'ROLE_REVEAL', 'VOTE_MODIFIER', 'SURVIVE_DEATH', 'REVENGE', 'COMMUNICATE_WITH_DEAD', 'MODIFY_VOTING', 'TEAM_SUPPORT')),
	CONSTRAINT "ability_instances_handler_key_ck" CHECK (handler_key in ('infection.convert', 'cursed.onSurvivedWolfAttack', 'jester.onDayElimination', 'assassin.onTargetEliminated', 'avenger.queueRevenge', 'shapeshifter.scheduleCopy', 'assistant.inheritDoctor', 'immortal.consumeCharge')),
	CONSTRAINT "ability_instances_status_ck" CHECK (status in ('ACTIVE', 'REVOKED', 'EXHAUSTED', 'SCHEDULED')),
	CONSTRAINT "ability_instances_source_ck" CHECK (source in ('NATIVE', 'COPY', 'INHERITED')),
	CONSTRAINT "ability_instances_charges_ck" CHECK (charges_remaining >= 0),
	CONSTRAINT "ability_instances_uses_ck" CHECK (uses_consumed >= 0),
	CONSTRAINT "ability_instances_available_ck" CHECK (available_from_round >= 1)
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"original_role_id" text NOT NULL,
	"original_profile_id" text NOT NULL,
	"original_faction" text NOT NULL,
	"current_role_id" text NOT NULL,
	"current_profile_id" text NOT NULL,
	"current_faction" text NOT NULL,
	"wolf_aligned" boolean NOT NULL,
	"individual_victory" text DEFAULT 'NONE' NOT NULL,
	"public_reveal" boolean DEFAULT false NOT NULL,
	"mark_target_player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignments_original_faction_ck" CHECK (original_faction in ('VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT')),
	CONSTRAINT "role_assignments_current_faction_ck" CHECK (current_faction in ('VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT')),
	CONSTRAINT "role_assignments_individual_victory_ck" CHECK (individual_victory in ('NONE', 'ACHIEVED', 'FAILED', 'REVOKED'))
);
--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_assignment_id_role_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."role_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_last_target_player_id_game_players_id_fk" FOREIGN KEY ("last_target_player_id") REFERENCES "public"."game_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_source_player_id_game_players_id_fk" FOREIGN KEY ("source_player_id") REFERENCES "public"."game_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_mark_target_player_id_game_players_id_fk" FOREIGN KEY ("mark_target_player_id") REFERENCES "public"."game_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ability_instances_native_uq" ON "ability_instances" USING btree ("assignment_id","ability_id") WHERE source = 'NATIVE';--> statement-breakpoint
CREATE INDEX "ability_instances_game_player_idx" ON "ability_instances" USING btree ("game_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_assignments_player_uq" ON "role_assignments" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "role_assignments_game_idx" ON "role_assignments" USING btree ("game_id");--> statement-breakpoint
-- Hand-written: what was dealt never changes. Conversions update only the current_* columns.
-- The repository has no update path for these columns; this trigger stops any other path too.
-- See the note on `role_assignments` in src/db/schema.ts.
CREATE FUNCTION "role_assignments_keep_original"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.original_role_id IS DISTINCT FROM OLD.original_role_id
		OR NEW.original_profile_id IS DISTINCT FROM OLD.original_profile_id
		OR NEW.original_faction IS DISTINCT FROM OLD.original_faction
		OR NEW.game_id IS DISTINCT FROM OLD.game_id
		OR NEW.player_id IS DISTINCT FROM OLD.player_id THEN
		RAISE EXCEPTION 'role_assignments: the dealt role, faction, game, and player cannot change'
			USING ERRCODE = 'restrict_violation';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "role_assignments_keep_original_trg" BEFORE UPDATE ON "role_assignments"
	FOR EACH ROW EXECUTE FUNCTION "role_assignments_keep_original"();
