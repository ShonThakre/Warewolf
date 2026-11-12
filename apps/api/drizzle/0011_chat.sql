CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"body" text NOT NULL,
	"round_number" integer NOT NULL,
	"phase" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_body_ck" CHECK (char_length(body) between 1 and 280),
	CONSTRAINT "chat_messages_phase_ck" CHECK (phase in ('DAY_DISCUSSION', 'VOTING', 'REVOTE')),
	CONSTRAINT "chat_messages_round_ck" CHECK (round_number >= 1)
);
--> statement-breakpoint
CREATE TABLE "chat_mutes" (
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_mutes_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mutes" ADD CONSTRAINT "chat_mutes_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mutes" ADD CONSTRAINT "chat_mutes_player_id_game_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."game_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_seq_uq" ON "chat_messages" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "chat_messages_game_seq_idx" ON "chat_messages" USING btree ("game_id","seq");--> statement-breakpoint
-- OD-72 retention: chat lives only while the game runs. Every path that ends a
-- game (the phase machine, a host cancel, a surrender) writes games.status, so
-- the deletion sits on that column rather than in each code path.
CREATE FUNCTION "chat_forget_on_end"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	DELETE FROM "chat_messages" WHERE "game_id" = NEW."id";
	DELETE FROM "chat_mutes" WHERE "game_id" = NEW."id";
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "chat_forget_on_end_trg" AFTER UPDATE OF "status" ON "games"
	FOR EACH ROW
	WHEN (NEW."status" IN ('FINISHED', 'CANCELLED') AND OLD."status" IS DISTINCT FROM NEW."status")
	EXECUTE FUNCTION "chat_forget_on_end"();
