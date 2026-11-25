ALTER TABLE "game_players" ADD COLUMN "device_key_hash" text;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "rejoin_code_hash" text;--> statement-breakpoint
CREATE INDEX "game_players_device_idx" ON "game_players" USING btree ("game_id","device_key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_rejoin_uq" ON "game_players" USING btree ("game_id","rejoin_code_hash");