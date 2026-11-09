CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text NOT NULL,
	"status" text DEFAULT 'LOBBY' NOT NULL,
	"phase" text DEFAULT 'LOBBY' NOT NULL,
	"round_number" integer DEFAULT 0 NOT NULL,
	"state_version" integer DEFAULT 0 NOT NULL,
	"host_player_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"config_snapshot" jsonb,
	"config_draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"catalog_hash" text,
	"phase_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phase_ends_at" timestamp with time zone,
	"winner_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_room_code_length_ck" CHECK (char_length(room_code) = 6),
	CONSTRAINT "games_status_ck" CHECK (status in ('LOBBY', 'ACTIVE', 'FINISHED', 'CANCELLED')),
	CONSTRAINT "games_phase_ck" CHECK (phase in ('LOBBY', 'ROLE_REVEAL', 'NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION', 'DAY_ANNOUNCE', 'DAY_DISCUSSION', 'VOTING', 'REVOTE', 'FINISHED', 'CANCELLED')),
	CONSTRAINT "games_mode_ck" CHECK (mode in ('INFECTION', 'CLASSIC', 'EXPANDED', 'CUSTOM')),
	CONSTRAINT "games_round_number_ck" CHECK (round_number >= 0),
	CONSTRAINT "games_state_version_ck" CHECK (state_version >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "games_room_code_open_uq" ON "games" USING btree (room_code) WHERE status in ('LOBBY', 'ACTIVE');--> statement-breakpoint
CREATE INDEX "games_status_phase_idx" ON "games" USING btree (status,phase);