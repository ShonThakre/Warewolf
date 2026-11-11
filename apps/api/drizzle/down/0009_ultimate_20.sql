-- Reverts 0009_ultimate_20.sql.
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_mode_ck";
ALTER TABLE "games" ADD CONSTRAINT "games_mode_ck" CHECK (mode in ('INFECTION', 'CLASSIC', 'EXPANDED', 'CUSTOM'));
ALTER TABLE "ability_instances" DROP CONSTRAINT IF EXISTS "ability_instances_capability_ck";
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_capability_ck" CHECK (capability in ('INVESTIGATE', 'PROTECT', 'HEAL', 'KILL', 'POISON', 'INFECT', 'BLOCK_ACTION', 'TRACK', 'DETECT', 'ROLE_COPY', 'ROLE_REVEAL', 'VOTE_MODIFIER', 'SURVIVE_DEATH', 'REVENGE', 'COMMUNICATE_WITH_DEAD', 'MODIFY_VOTING', 'TEAM_SUPPORT'));
ALTER TABLE "investigation_records" DROP CONSTRAINT IF EXISTS "investigation_records_kind_ck";
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_kind_ck" CHECK (kind in ('ALIGNMENT_WOLF_OR_NOT', 'ROLE_CATEGORY', 'ROLE_ID', 'SAME_OR_DIFFERENT_FACTION', 'ROLE_AT_DEATH', 'VISITED_PLAYER_IDS', 'YES_NO', 'WOLF_KILL_SUBMISSION_COUNT', 'ATTACKER_IDS'));
ALTER TABLE "night_actions" DROP CONSTRAINT IF EXISTS "night_actions_rejected_reason_ck";
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_rejected_reason_ck" CHECK (rejected_reason in ('ABILITY_UNAVAILABLE', 'WRONG_PHASE', 'TARGET_ILLEGAL', 'BLOCKED', 'NOT_IMPLEMENTED'));
ALTER TABLE "role_conversion_records" DROP CONSTRAINT IF EXISTS "role_conversion_records_reason_ck";
ALTER TABLE "role_conversion_records" ADD CONSTRAINT "role_conversion_records_reason_ck" CHECK (reason in ('INFECTION', 'CURSED', 'INHERIT', 'COPY_GRANT', 'COPY_EXPIRE'));
ALTER TABLE "scheduled_effects" DROP CONSTRAINT IF EXISTS "scheduled_effects_kind_ck";
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_kind_ck" CHECK (kind in ('SHIELD', 'POISON', 'REVENGE'));
