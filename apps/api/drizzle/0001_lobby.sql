CREATE TABLE "game_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"seat_number" integer NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"life_status" text DEFAULT 'ALIVE' NOT NULL,
	"connection_status" text DEFAULT 'DISCONNECTED' NOT NULL,
	"token_hash" text NOT NULL,
	"died_round" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_seat_ck" CHECK (seat_number >= 1),
	CONSTRAINT "game_players_life_ck" CHECK (life_status in ('ALIVE', 'DEAD')),
	CONSTRAINT "game_players_connection_ck" CHECK (connection_status in ('CONNECTED', 'DISCONNECTED')),
	CONSTRAINT "game_players_name_length_ck" CHECK (char_length(display_name) between 2 and 24)
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_token_hash_uq" ON "game_players" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_name_uq" ON "game_players" USING btree ("game_id",lower(display_name));--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_seat_uq" ON "game_players" USING btree ("game_id","seat_number");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_one_host_uq" ON "game_players" USING btree ("game_id") WHERE is_host;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_cancel_reason_ck" CHECK (cancel_reason in ('HOST', 'SURRENDER'));--> statement-breakpoint
-- Hand-written: the host key must be deferrable because a game and its host seat reference each other
-- and are inserted in one transaction. See the note on `games` in src/db/schema.ts.
ALTER TABLE "games" ADD CONSTRAINT "games_host_player_id_game_players_id_fk" FOREIGN KEY ("host_player_id") REFERENCES "public"."game_players"("id") DEFERRABLE INITIALLY DEFERRED;
