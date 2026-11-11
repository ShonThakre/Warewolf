-- Edited by hand: existing seats get avatar_id = seat_number before the column becomes NOT NULL.
-- Seat numbers are unique per game and never above 30, so they are valid, unique avatar ids.
ALTER TABLE "game_players" ADD COLUMN "avatar_id" integer;--> statement-breakpoint
UPDATE "game_players" SET "avatar_id" = "seat_number" WHERE "avatar_id" IS NULL;--> statement-breakpoint
ALTER TABLE "game_players" ALTER COLUMN "avatar_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_avatar_uq" ON "game_players" USING btree ("game_id","avatar_id");--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_avatar_ck" CHECK (avatar_id between 1 and 36);
