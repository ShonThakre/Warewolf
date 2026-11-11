import type { AbilityDefinition, HandlerKey } from '../catalog/types.js';
import type { Capability } from '../roles.js';

/**
 * The capability handler registry (WW-602). The engine finds what to do with
 * an ability by its capability, or by its `handlerKey` when the ability has
 * no capability (the Assassin's mark). It never switches on a role id, so a
 * new role made of existing capabilities needs no engine change, and a new
 * capability needs one registry entry. See implementation-plan.md, section 6.
 *
 * Phase 6 uses the submission side of each handler. The night resolver
 * (WW-801) reads `nightStep` to find the pipeline step that resolves a
 * submitted action (night-resolution.md, section 2).
 */

/**
 * The pipeline step that resolves a submitted night action. Null for
 * abilities the night resolver never receives as actions: day abilities and
 * the automatic mechanics, which the resolver fires on its own triggers.
 */
export const NIGHT_STEPS = ['REWIND', 'BLOCK', 'CHAOS', 'INFORMATION', 'TRAP', 'ATTACK', 'PROTECTION', 'HEAL', 'INFECTION', 'CONVERT', 'COPY', 'SILENCE', 'REVIVE', 'HINT', 'MARK'] as const;
export type NightStep = (typeof NIGHT_STEPS)[number];

export interface CapabilityHandler {
  /** The capability, or for capability-less abilities the handler key, this entry serves. */
  readonly key: Capability | HandlerKey;
  /**
   * Whether a player submits this as an action. False for passive and
   * trigger-driven mechanics (vote weight, Immortal, Avenger revenge,
   * inheritance), which the resolver applies by itself.
   */
  readonly submittable: boolean;
  /** Where the night resolver handles a submitted action of this kind. */
  readonly nightStep: NightStep | null;
}

export type CapabilityRegistry = ReadonlyMap<Capability | HandlerKey, CapabilityHandler>;

export function createCapabilityRegistry(handlers: readonly CapabilityHandler[]): CapabilityRegistry {
  const registry = new Map<Capability | HandlerKey, CapabilityHandler>();
  for (const handler of handlers) {
    if (registry.has(handler.key)) throw new Error(`Duplicate capability handler ${handler.key}`);
    registry.set(handler.key, handler);
  }
  return registry;
}

const submitted = (key: CapabilityHandler['key'], nightStep: NightStep | null): CapabilityHandler => ({ key, submittable: true, nightStep });
const automatic = (key: CapabilityHandler['key']): CapabilityHandler => ({ key, submittable: false, nightStep: null });

/** The shipped handlers. Every capability and handler key has an entry, so a missing one is a bug, not a silent no-op. */
export const DEFAULT_CAPABILITY_REGISTRY: CapabilityRegistry = createCapabilityRegistry([
  submitted('INVESTIGATE', 'INFORMATION'),
  submitted('PROTECT', 'PROTECTION'),
  submitted('HEAL', 'HEAL'),
  // Day kills (the Sniper) never reach the night resolver; the day resolver handles them.
  submitted('KILL', 'ATTACK'),
  submitted('POISON', 'ATTACK'),
  submitted('INFECT', 'INFECTION'),
  submitted('BLOCK_ACTION', 'BLOCK'),
  submitted('TRACK', 'INFORMATION'),
  // The Spy and the Prophet. A DETECT ability that returns ATTACKER_IDS is a trap (step 6).
  submitted('DETECT', 'INFORMATION'),
  submitted('ROLE_COPY', 'COPY'),
  // A day ability: the Seeker publishes a stored result. Not part of the night.
  submitted('ROLE_REVEAL', null),
  automatic('VOTE_MODIFIER'),
  // Mind Controller: a day ability. The day tally applies it. Not a night step.
  submitted('MODIFY_VOTING', null),
  automatic('SURVIVE_DEATH'),
  automatic('REVENGE'),
  automatic('TEAM_SUPPORT'),
  // Disabled until a real dead channel is approved (role-catalog.md). Medium uses INVESTIGATE.
  automatic('COMMUNICATE_WITH_DEAD'),
  submitted('CONVERT', 'CONVERT'),
  submitted('REWIND', 'REWIND'),
  submitted('SILENCE', 'SILENCE'),
  submitted('REVIVE', 'REVIVE'),
  submitted('HINT', 'HINT'),
  submitted('CHAOS', 'CHAOS'),
  // Handler keys carry mechanics a capability flag cannot. Only the Assassin's night-1 mark,
  // which has no capability, is submitted through one; the rest fire on resolver triggers.
  submitted('assassin.onTargetEliminated', 'MARK'),
  automatic('infection.convert'),
  automatic('cursed.onSurvivedWolfAttack'),
  automatic('jester.onDayElimination'),
  automatic('avenger.queueRevenge'),
  automatic('shapeshifter.scheduleCopy'),
  automatic('assistant.inheritDoctor'),
  automatic('immortal.consumeCharge'),
]);

/** The handler for an ability: its capability first, then its handler key. Undefined when none is registered. */
export function handlerFor(ability: AbilityDefinition, registry: CapabilityRegistry = DEFAULT_CAPABILITY_REGISTRY): CapabilityHandler | undefined {
  if (ability.capability) return registry.get(ability.capability);
  return ability.handlerKey ? registry.get(ability.handlerKey) : undefined;
}
