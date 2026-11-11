CREATE TABLE "idempotency_keys" (
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_pk" PRIMARY KEY("game_id","player_id","key")
);
--> statement-breakpoint
CREATE TABLE "night_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"phase" text NOT NULL,
	"player_id" uuid NOT NULL,
	"ability_instance_id" uuid NOT NULL,
	"target_player_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "night_actions_status_ck" CHECK (status in ('PENDING', 'LOCKED', 'RESOLVED', 'REJECTED', 'CANCELLED')),
	CONSTRAINT "night_actions_phase_ck" CHECK (phase in ('NIGHT_SUBMIT', 'NIGHT_REACTION', 'DAY_DISCUSSION')),
	CONSTRAINT "night_actions_round_ck" CHECK (round_number >= 1)
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_ability_instance_id_ability_instances_id_fk" FOREIGN KEY ("ability_instance_id") REFERENCES "public"."ability_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "night_actions_open_uq" ON "night_actions" USING btree ("game_id","round_number","ability_instance_id") WHERE status in ('PENDING', 'LOCKED');--> statement-breakpoint
CREATE INDEX "night_actions_game_round_idx" ON "night_actions" USING btree ("game_id","round_number","status");