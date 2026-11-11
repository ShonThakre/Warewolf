CREATE TABLE "game_events" (
	"game_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"type" text NOT NULL,
	"audience" text NOT NULL,
	"recipient_player_id" uuid,
	"payload" jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_events_game_id_seq_pk" PRIMARY KEY("game_id","seq"),
	CONSTRAINT "game_events_audience_ck" CHECK (audience in ('PUBLIC', 'HOST', 'PLAYER')),
	CONSTRAINT "game_events_recipient_ck" CHECK ((audience = 'PLAYER') = (recipient_player_id is not null)),
	CONSTRAINT "game_events_seq_ck" CHECK (seq >= 1)
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_recipient_player_id_game_players_id_fk" FOREIGN KEY ("recipient_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_events_dedupe_uq" ON "game_events" USING btree ("game_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "game_events_audience_idx" ON "game_events" USING btree ("game_id","audience","recipient_player_id","seq");
