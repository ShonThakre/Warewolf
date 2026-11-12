CREATE TABLE "day_tallies" (
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"ballot" integer NOT NULL,
	"counts" jsonb NOT NULL,
	"abstentions" integer NOT NULL,
	"voted_out_player_id" uuid,
	"tied_player_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_tallies_pk" PRIMARY KEY("game_id","round_number","ballot"),
	CONSTRAINT "day_tallies_ballot_ck" CHECK (ballot in (1, 2)),
	CONSTRAINT "day_tallies_round_ck" CHECK (round_number >= 1),
	CONSTRAINT "day_tallies_abstentions_ck" CHECK (abstentions >= 0)
);
--> statement-breakpoint
ALTER TABLE "day_tallies" ADD CONSTRAINT "day_tallies_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_tallies" ADD CONSTRAINT "day_tallies_voted_out_player_id_game_players_id_fk" FOREIGN KEY ("voted_out_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;