DROP INDEX IF EXISTS "game_players_rejoin_uq";
DROP INDEX IF EXISTS "game_players_device_idx";
ALTER TABLE "game_players" DROP COLUMN IF EXISTS "rejoin_code_hash";
ALTER TABLE "game_players" DROP COLUMN IF EXISTS "device_key_hash";
