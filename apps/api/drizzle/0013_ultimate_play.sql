ALTER TABLE "games" ADD COLUMN "chaos_successes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "chaos_achieved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "chaos_used_kinds" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "revived_by" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD COLUMN "chaos_kind" text;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD COLUMN "player_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD COLUMN "chaos_counted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_effects" DROP CONSTRAINT "scheduled_effects_attack_types_ck";--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_attack_types_ck" CHECK (attack_types <@ array['WOLF_KILL', 'SNIPER', 'POISON', 'REVENGE', 'DAY_VOTE', 'VAMPIRE']::text[]);--> statement-breakpoint
ALTER TABLE "scheduled_effects" ADD CONSTRAINT "scheduled_effects_chaos_kind_ck" CHECK (chaos_kind is null or chaos_kind in ('ABILITY_DISABLED', 'PROTECTIONS_OFF', 'NO_KILLS', 'NO_VOTE', 'SWAP_VOTES', 'DOUBLE_VOTE'));
