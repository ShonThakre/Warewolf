-- Reverts 0002_avatars.sql.
ALTER TABLE "game_players" DROP CONSTRAINT IF EXISTS "game_players_avatar_ck";
DROP INDEX IF EXISTS "game_players_avatar_uq";
ALTER TABLE "game_players" DROP COLUMN IF EXISTS "avatar_id";
