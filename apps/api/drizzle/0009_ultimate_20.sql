ALTER TABLE "games" DROP CONSTRAINT "games_mode_ck";--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_mode_ck" CHECK (mode in ('INFECTION', 'CLASSIC', 'EXPANDED', 'CUSTOM', 'ULTIMATE_20'));--> statement-breakpoint
ALTER TABLE "ability_instances" DROP CONSTRAINT "ability_instances_capability_ck";--> statement-breakpoint
ALTER TABLE "ability_instances" ADD CONSTRAINT "ability_instances_capability_ck" CHECK (capability in ('INVESTIGATE', 'PROTECT', 'HEAL', 'KILL', 'POISON', 'INFECT', 'BLOCK_ACTION', 'TRACK', 'DETECT', 'ROLE_COPY', 'ROLE_REVEAL', 'VOTE_MODIFIER', 'SURVIVE_DEATH', 'REVENGE', 'COMMUNICATE_WITH_DEAD', 'MODIFY_VOTING', 'TEAM_SUPPORT', 'CONVERT', 'REWIND', 'SILENCE', 'REVIVE', 'HINT', 'CHAOS'));--> statement-breakpoint
ALTER TABLE "investigation_records" DROP CONSTRAINT "investigation_records_kind_ck";--> statement-breakpoint
ALTER TABLE "investigation_records" ADD CONSTRAINT "investigation_records_kind_ck" CHECK (kind in ('ALIGNMENT_WOLF_OR_NOT', 'ROLE_CATEGORY', 'ROLE_ID', 'SAME_OR_DIFFERENT_FACTION', 'ROLE_AT_DEATH', 'VISITED_PLAYER_IDS', 'YES_NO', 'WOLF_KILL_SUBMISSION_COUNT', 'ATTACKER_IDS', 'FACTION'));--> statement-breakpoint
ALTER TABLE "night_actions" DROP CONSTRAINT "night_actions_rejected_reason_ck";--> statement-breakpoint
ALTER TABLE "night_actions" ADD CONSTRAINT "night_actions_rejected_reason_ck" CHECK (rejected_reason in ('ABILITY_UNAVAILABLE', 'WRONG_PHASE', 'TARGET_ILLEGAL', 'BLOCKED', 'NOT_IMPLEMENTED', 'SUPERSEDED', 'REWOUND'));--> statement-breakpoint
ALTER TABLE "role_conversion_records" DROP CONSTRAINT "role_conversion_records_reason_ck";--> statement-breakpoint
ALTER TABLE "role_conversion_records" ADD CONSTRAINT "role_conversion_records_reason_ck" CHECK (reason in ('INFECTION', 'CURSED', 'VAMPIRE', 'INHERIT', 'COPY_GRANT', 'COPY_EXPIRE'));--> statement-breakpoint
ALTER TABLE "scheduled_effects" DROP CONSTRAINT "scheduled_effects_kind_ck";--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_kind_ck" CHECK (kind in ('SHIELD', 'POISON', 'REVENGE', 'VAMPIRE_MARK', 'RETURNED', 'CHAOS_DAY'));
