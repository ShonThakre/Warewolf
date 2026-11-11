-- Reverts 0006_night_resolution.sql.
DROP TABLE IF EXISTS "scheduled_effects";
DROP TABLE IF EXISTS "role_conversion_records";
DROP TABLE IF EXISTS "investigation_records";
DROP TABLE IF EXISTS "infection_records";
DROP TABLE IF EXISTS "elimination_records";
DROP TABLE IF EXISTS "resolution_runs";
ALTER TABLE "night_actions" DROP CONSTRAINT IF EXISTS "night_actions_rejected_status_ck";
ALTER TABLE "night_actions" DROP CONSTRAINT IF EXISTS "night_actions_rejected_reason_ck";
ALTER TABLE "night_actions" DROP COLUMN IF EXISTS "rejected_reason";
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_infection_successes_ck";
ALTER TABLE "games" DROP COLUMN IF EXISTS "infection_sealed";
ALTER TABLE "games" DROP COLUMN IF EXISTS "infection_successes";
