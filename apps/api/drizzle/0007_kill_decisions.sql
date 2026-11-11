CREATE TABLE "night_kill_decisions" (
	"game_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"target_player_id" uuid,
	"no_kill" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "night_kill_decisions_pk" PRIMARY KEY("game_id","round_number"),
	CONSTRAINT "night_kill_decisions_choice_ck" CHECK (no_kill = (target_player_id is null)),
	CONSTRAINT "night_kill_decisions_round_ck" CHECK (round_number >= 1)
);
--> statement-breakpoint
ALTER TABLE "night_kill_decisions" ADD CONSTRAINT "night_kill_decisions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "night_kill_decisions" ADD CONSTRAINT "night_kill_decisions_target_player_id_game_players_id_fk" FOREIGN KEY ("target_player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;