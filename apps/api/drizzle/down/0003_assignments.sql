-- Reverts 0003_assignments.sql.
DROP TABLE IF EXISTS "ability_instances";
DROP TABLE IF EXISTS "role_assignments";
DROP FUNCTION IF EXISTS "role_assignments_keep_original"();
