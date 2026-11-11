-- Reverts 0004_phase_machine.sql.
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_deadline_ck";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_round_status_ck";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_phase_status_ck";
DROP INDEX IF EXISTS "games_phase_deadline_idx";
