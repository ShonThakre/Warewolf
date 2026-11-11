-- Reverts 0001_lobby.sql.
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_host_player_id_game_players_id_fk";
DROP TABLE IF EXISTS "game_players";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_cancel_reason_ck";
ALTER TABLE "games" DROP COLUMN IF EXISTS "cancel_reason";
