import { DEFAULT_CAPABILITY_REGISTRY, handlerFor, type NightStep } from '../action/registry.js';
import { actionWindow, consumeUse, exclusiveGroupOf } from '../action/submission.js';
import { DEFAULT_CATALOG, type RoleCatalog } from '../catalog/catalog.js';
import type { AbilityDefinition, AttackType } from '../catalog/types.js';
import type { LifeStatus } from '../game.js';
import type { AbilityInstanceId, PlayerId } from '../snapshot.js';
import { informationFor, unanswerable, type InformationContext } from './information.js';
import type {
  AbilityGrant,
  AbilityUpdate,
  ActionOutcome,
  ActionRejection,
  AttackVia,
  Block,
  Conversion,
  Copy,
  CursedFailure,
  Death,
  EffectClosure,
  Inheritance,
  InfectionFailure,
  ChaosEvent,
  Hint,
  InfectionOutcome,
  InvestigationResult,
  Mark,
  Revival,
  Rewind,
  Silence,
  NightAbility,
  NightAction,
  NightAssignment,
  NightEffectSpec,
  NightInput,
  NightResult,
  Redirect,
  Revenge,
  Visit,
} from './types.js';

export * from './types.js';

/**
 * `resolveNight` (WW-701, WW-801). Pure: it takes the start-of-night state,
 * the locked actions, and the open effects, and returns everything the night
 * changed. It does not read a clock, a database, or a random source.
 * See docs/werewolf/night-resolution.md; the step numbers below are its
 * section 2.
 *
 * Steps run in the documented order. Victory (step 19) is WW-902 and runs on
 * the result. Inside a step, work is ordered by action id, then player id,
 * so equal inputs give equal outputs.
 *
 * Nothing here switches on a role id. An action reaches its step through the
 * capability registry (`nightStep`); automatic mechanics are found by their
 * capability or handler key: Immortal (`SURVIVE_DEATH`), Avenger (`REVENGE`),
 * Cursed (`cursed.onSurvivedWolfAttack`), and the Healer Assistant
 * (`assistant.inheritDoctor`, which names the role it inherits in its config).
 */

interface Accepted {
  readonly action: NightAction;
  readonly ability: NightAbility;
  readonly def: AbilityDefinition;
  readonly step: NightStep;
}

/** One lethal on its way to a player. Cancelled when any saver is listed. */
interface Attack {
  readonly key: string;
  readonly target: PlayerId;
  readonly type: AttackType;
  readonly via: AttackVia;
  /** For a redirect, how the original attack arrived. */
  readonly origin: AttackVia;
  readonly actorIds: readonly PlayerId[];
  readonly cancelledBy: AbilityInstanceId[];
}

/** Something that cancels attacks on one player: a protection, a heal, an item, or a trap. */
interface Shield {
  readonly target: PlayerId;
  readonly by: AbilityInstanceId;
  readonly covers: (attack: Attack) => boolean;
  /** Called each time the shield cancels an attack. */
  readonly onCancel?: () => void;
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortedUnique = (ids: readonly PlayerId[]) => [...new Set(ids)].sort(byString);
const isLive = (attack: Attack) => attack.cancelledBy.length === 0;

const POISON_DELAYS = ['END_OF_NEXT_DAY_RESOLUTION', 'NEXT_DAWN'] as const;

/** The step a submitted night action belongs to, or null when nothing resolves it. */
function stepOf(def: AbilityDefinition): NightStep | null {
  if (def.capability === 'DETECT' && def.result === 'ATTACKER_IDS') return 'TRAP';
  return handlerFor(def, DEFAULT_CAPABILITY_REGISTRY)?.nightStep ?? null;
}

/** Settings this build does not resolve. Such actions are rejected in step 1 and spend nothing. */
function unsupported(def: AbilityDefinition, step: NightStep): boolean {
  switch (step) {
    case 'INFORMATION':
      return unanswerable(def) !== null;
    case 'ATTACK':
      return def.capability === 'POISON' && def.config['delay'] !== undefined && !(POISON_DELAYS as readonly unknown[]).includes(def.config['delay']);
    case 'COPY':
      // OD-31: permanent theft is off by default and has no specified rules.
      return def.config['permanentSteal'] === true;
    default:
      return false;
  }
}

export function resolveNight(input: NightInput): NightResult {
  const catalog = input.catalog ?? DEFAULT_CATALOG;
  const { config, round } = input;
  const toggles = config.night.toggles;
  const life = new Map(input.players.map((p) => [p.id, p.lifeStatus]));
  const alive = (playerId: PlayerId) => life.get(playerId) === 'ALIVE';
  const assignment = new Map(input.assignments.map((a) => [a.playerId, a]));
  const abilityById = new Map(input.abilities.map((a) => [a.id, a]));
  const abilitiesOf = (playerId: PlayerId) => input.abilities.filter((a) => a.playerId === playerId).sort(byId);
  const effects = [...(input.effects ?? [])].sort(byId);
  const outcomes = new Map<string, ActionOutcome>();
  const reject = (action: NightAction, reason: ActionRejection) => outcomes.set(action.id, { actionId: action.id, status: 'REJECTED', reason });
  const closedEffects = new Map<string, EffectClosure>();
  const newEffects: NightEffectSpec[] = [];
  const updates = new Map<AbilityInstanceId, AbilityUpdate['patch']>();
  const spend = (ability: NightAbility, targets: readonly PlayerId[] = []) => updates.set(ability.id, consumeUse(ability, round, targets));

  // Step 1: drop illegal actions. Submission already checked them; this guards the state at close.
  const accepted: Accepted[] = [];
  const spentOnIllegal: Accepted[] = [];
  for (const action of [...input.actions].sort(byId)) {
    const ability = abilityById.get(action.abilityInstanceId);
    if (!ability || ability.playerId !== action.playerId || ability.status !== 'ACTIVE') {
      reject(action, 'ABILITY_UNAVAILABLE');
      continue;
    }
    const def = ability.config;
    const window = actionWindow(def.timing);
    if (action.phase !== window || (window !== 'NIGHT_SUBMIT' && window !== 'NIGHT_REACTION')) {
      reject(action, 'WRONG_PHASE');
      continue;
    }
    const step = stepOf(def);
    if (!step || unsupported(def, step)) {
      reject(action, 'NOT_IMPLEMENTED');
      continue;
    }
    const rule = def.target;
    const illegalLife = rule.kind === 'PLAYERS' && action.targetPlayerIds.some((t) => life.get(t) !== rule.life);
    const illegalRepeat = rule.kind === 'PLAYERS' && rule.notSameAsLastRound && ability.lastUsedRound === round - 1 && action.targetPlayerIds.includes(ability.lastTargetPlayerId ?? '');
    if (illegalLife || illegalRepeat) {
      reject(action, 'TARGET_ILLEGAL');
      spentOnIllegal.push({ action, ability, def, step });
      continue;
    }
    accepted.push({ action, ability, def, step });
  }

  // Exclusive groups (Alpha's kill-or-infect, a Mimic's copied potions): the latest action id stands.
  const grouped = new Map<string, Accepted[]>();
  for (const item of accepted) {
    const group = exclusiveGroupOf(item.def);
    if (!group) continue;
    const key = `${item.action.playerId}:${group}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const superseded = new Set<string>();
  for (const list of grouped.values()) {
    const sorted = [...list].sort((a, b) => byId(a.action, b.action));
    for (const old of sorted.slice(0, -1)) superseded.add(old.action.id);
  }
  for (const item of accepted) if (superseded.has(item.action.id)) reject(item.action, 'SUPERSEDED');
  const afterGroups = accepted.filter((item) => !superseded.has(item.action.id));

  // Step 2a: Time Wizard. A rewind removes the target's actions tonight, including a block.
  // A block cancels the rewind only when it comes from someone the rewind did not target.
  const rewinds: Rewind[] = [];
  const rewound = new Set<string>();
  for (const rewind of afterGroups.filter((item) => item.step === 'REWIND')) {
    const targetId = rewind.action.targetPlayerIds[0]!;
    const blockedByOutsider = afterGroups.some(
      (item) => item.step === 'BLOCK' && item.action.targetPlayerIds[0] === rewind.action.playerId && item.action.playerId !== targetId,
    );
    if (blockedByOutsider) continue;
    const removed = afterGroups.filter((item) => item.action.playerId === targetId && item.action.id !== rewind.action.id);
    for (const item of removed) {
      rewound.add(item.action.id);
      reject(item.action, 'REWOUND');
    }
    rewinds.push({ actionId: rewind.action.id, actorId: rewind.action.playerId, targetId, removedActionIds: removed.map((item) => item.action.id) });
  }
  const opened = afterGroups.filter((item) => !rewound.has(item.action.id));

  // Step 2: blocks. Every block lands, and they land together: a blocked Disruptor's own block still
  // stands, so the result never depends on which of two Disruptors sorts first. Cancelled actions
  // make no visits and no effects, and the victim spends nothing (section 7).
  const blockActions = opened.filter((a) => a.step === 'BLOCK');
  const blockedPlayers = new Set(blockActions.map((a) => a.action.targetPlayerIds[0]!));
  const isBlocked = (a: Accepted) => a.step !== 'BLOCK' && blockedPlayers.has(a.action.playerId);
  const blocks: Block[] = blockActions.map((a) => {
    const targetId = a.action.targetPlayerIds[0]!;
    return {
      actionId: a.action.id,
      actorId: a.action.playerId,
      targetId,
      cancelledActionIds: opened.filter((b) => isBlocked(b) && b.action.playerId === targetId).map((b) => b.action.id),
      informTarget: a.def.config['informTarget'] === true || toggles.informBlockedPlayer,
    };
  });
  for (const a of opened) if (isBlocked(a)) reject(a.action, 'BLOCKED');
  let active = opened.filter((a) => !isBlocked(a));
  const of = (step: NightStep) => active.filter((a) => a.step === step);

  // Chaos applies only when the demon's action survived the rewind and the blocks.
  const chaosAction = of('CHAOS')[0];
  const chaos = chaosAction && input.chaos ? input.chaos : null;
  let chaosSuccess: boolean | null = null;
  const protectionsOff = chaos?.kind === 'PROTECTIONS_OFF';
  const noKills = chaos?.kind === 'NO_KILLS';
  if (chaosAction && !input.chaos) reject(chaosAction.action, 'NOT_IMPLEMENTED');
  if (chaos?.kind === 'ABILITY_DISABLED') {
    const disabled = new Set(chaos.playerIds);
    const cancelled = active.filter((item) => disabled.has(item.action.playerId) && item.step !== 'CHAOS');
    for (const item of cancelled) reject(item.action, 'BLOCKED');
    active = active.filter((item) => !cancelled.includes(item));
    chaosSuccess = cancelled.length > 0;
  }

  // Step 4: one pack target from the wolf submissions that survived the blocks.
  const isPack = (playerId: PlayerId) => assignment.get(playerId)?.currentFaction === 'WOLF_PACK';
  const wolfKills = of('ATTACK').filter((a) => a.def.capability === 'KILL' && a.def.attackType === 'WOLF_KILL');
  const packKills = wolfKills.filter((a) => isPack(a.action.playerId));
  const finalWolfTarget = aggregatePackKill(input, packKills, life, isPack);

  // Steps 3 and 17: information. Read from the start-of-night state, so the order of the
  // remaining steps cannot change an answer. Tracking reads tonight's surviving actions.
  const visits = new Map<PlayerId, Visit[]>();
  for (const a of active) {
    // The informed Doctor names nobody; their save goes to the confirmed target.
    const targets = a.def.target.kind === 'FINAL_WOLF_TARGET' ? (finalWolfTarget ? [finalWolfTarget] : []) : a.action.targetPlayerIds;
    for (const playerId of targets) visits.set(a.action.playerId, [...(visits.get(a.action.playerId) ?? []), { playerId, capability: a.def.capability }]);
  }
  const informationContext: InformationContext = {
    catalog,
    life,
    assignment,
    assignments: input.assignments,
    visits,
    wolfKillSubmissions: wolfKills.length,
    includeActionTypes: toggles.trackerIncludesActionType,
  };
  const investigations: InvestigationResult[] = of('INFORMATION').map((a) => ({
    actionId: a.action.id,
    actorId: a.action.playerId,
    abilityInstanceId: a.ability.id,
    abilityId: a.def.id,
    targetPlayerIds: [...a.action.targetPlayerIds],
    ...informationFor(a.def, a.action, { ...informationContext, includeActionTypes: toggles.trackerIncludesActionType || a.def.config['includesActionType'] === true }),
  }));

  // Step 5: collect attacks, in step order: the pack, other kills, immediate poison, then effects due tonight.
  const attacks: Attack[] = [];
  const addAttack = (attack: Omit<Attack, 'cancelledBy' | 'origin'> & { origin?: AttackVia }) => {
    const added: Attack = { ...attack, origin: attack.origin ?? attack.via, cancelledBy: [] };
    attacks.push(added);
    return added;
  };
  if (finalWolfTarget) {
    const contributors = packKills.filter((a) => a.action.targetPlayerIds[0] === finalWolfTarget).map((a) => a.action.playerId);
    addAttack({ key: 'pack', target: finalWolfTarget, type: 'WOLF_KILL', via: 'PACK', actorIds: sortedUnique(contributors) });
  }
  // Kills outside the pack (the Lone Wolf, a copied kill) are their own named attack (section 3).
  for (const a of of('ATTACK')) {
    if (packKills.includes(a)) continue;
    if (a.def.capability === 'POISON' && a.def.config['delay'] !== undefined) continue;
    addAttack({ key: `action:${a.action.id}`, target: a.action.targetPlayerIds[0]!, type: a.def.attackType ?? 'WOLF_KILL', via: 'ABILITY', actorIds: [a.action.playerId] });
  }
  for (const effect of effects) {
    if (effect.kind === 'SHIELD') {
      if (!alive(effect.targetPlayerId)) closedEffects.set(effect.id, 'EXPIRED');
      continue;
    }
    // Marks, returns, and day chaos are not attacks. Vampire marks resolve after deaths.
    if (effect.kind === 'VAMPIRE_MARK' || effect.kind === 'RETURNED' || effect.kind === 'CHAOS_DAY') continue;
    if (effect.duePhase !== 'NIGHT' || effect.dueRound === null || effect.dueRound > round) continue;
    closedEffects.set(effect.id, alive(effect.targetPlayerId) ? 'SPENT' : 'EXPIRED');
    if (!alive(effect.targetPlayerId)) continue;
    for (const type of effect.attackTypes) {
      addAttack({ key: `effect:${effect.id}:${type}`, target: effect.targetPlayerId, type, via: 'EFFECT', actorIds: [effect.sourcePlayerId] });
    }
  }
  const applyShields = (shields: readonly Shield[], to: readonly Attack[]) => {
    for (const attack of to) {
      for (const shield of shields) {
        if (shield.target !== attack.target || !shield.covers(attack)) continue;
        attack.cancelledBy.push(shield.by);
        shield.onCancel?.();
      }
    }
  };

  // Step 6: traps. A trap triggers when any pack wolf named the trapped player, reports every such
  // wolf, and cancels the pack attack on that player when its ability cancels WOLF_KILL (OD-15).
  // A trap that does not trigger spends no charge.
  const untriggeredTraps = new Set<string>();
  for (const trap of of('TRAP')) {
    const trapped = trap.action.targetPlayerIds[0]!;
    const attackers = sortedUnique(packKills.filter((k) => k.action.targetPlayerIds[0] === trapped).map((k) => k.action.playerId));
    if (attackers.length === 0) {
      untriggeredTraps.add(trap.action.id);
      continue;
    }
    investigations.push({
      actionId: trap.action.id,
      actorId: trap.action.playerId,
      abilityInstanceId: trap.ability.id,
      abilityId: trap.def.id,
      targetPlayerIds: [trapped],
      kind: 'ATTACKER_IDS',
      value: attackers,
    });
    applyShields([{ target: trapped, by: trap.ability.id, covers: (a) => a.via === 'PACK' && trap.def.cancels.includes(a.type) }], attacks);
  }

  // Step 7: protection. Guard, Shieldbearer, and Blacksmith cancel the attack types they list.
  // A Blacksmith item that blocks nothing tonight stays on its holder (OD-16).
  const protectionCancels = (def: AbilityDefinition): AttackType[] =>
    toggles.protectionBlocksPoison && !def.cancels.includes('POISON') ? [...def.cancels, 'POISON'] : [...def.cancels];
  const protections = of('PROTECTION');
  const bodyguards = protections.filter((a) => a.def.config['redirectToSelf'] === true);
  const items = new Map<string, { accepted: Accepted; used: boolean }>();
  const heldShields = new Map<string, boolean>();
  const protectionShields: Shield[] = [];
  for (const p of protections) {
    if (bodyguards.includes(p)) continue;
    const types = protectionCancels(p.def);
    const item = p.def.config['holdUntilBlocked'] === true ? { accepted: p, used: false } : null;
    if (item) items.set(p.action.id, item);
    protectionShields.push({
      target: p.action.targetPlayerIds[0]!,
      by: p.ability.id,
      covers: (a) => types.includes(a.type),
      ...(item ? { onCancel: () => (item.used = true) } : {}),
    });
  }
  for (const effect of effects) {
    if (effect.kind !== 'SHIELD' || closedEffects.has(effect.id)) continue;
    heldShields.set(effect.id, false);
    protectionShields.push({
      target: effect.targetPlayerId,
      by: effect.sourceAbilityInstanceId,
      covers: (a) => effect.attackTypes.includes(a.type),
      onCancel: () => heldShields.set(effect.id, true),
    });
  }
  const shieldWouldStop = (shields: readonly Shield[]) =>
    attacks.some((attack) => isLive(attack) && shields.some((shield) => shield.target === attack.target && shield.covers(attack)));
  let skippedShieldSaved = false;
  if (protectionsOff) skippedShieldSaved = shieldWouldStop(protectionShields);
  else applyShields(protectionShields, attacks);

  // Heal shields, built now because a Bodyguard does not take a hit a heal will cancel (step 8).
  // The informed Doctor saves only the kill they were shown: the pack attack (section 5).
  const healShields: Shield[] = [];
  for (const h of of('HEAL')) {
    const informed = h.def.target.kind === 'FINAL_WOLF_TARGET';
    const target = informed ? finalWolfTarget : h.action.targetPlayerIds[0];
    if (!target) continue;
    healShields.push({ target, by: h.ability.id, covers: (a) => h.def.cancels.includes(a.type) && (!informed || a.via === 'PACK') });
  }

  // Step 8: redirect. A Bodyguard takes a wolf kill still aimed at their protectee, unless a
  // protection already cancelled it or a heal is about to (OD-14). The Bodyguard's own
  // protections, heals, and Immortal charge then apply to the redirected attack. No chains.
  const redirects: Redirect[] = [];
  for (const bg of bodyguards) {
    const protectee = bg.action.targetPlayerIds[0]!;
    const redirectsPoison = bg.def.config['redirectsPoison'] === true || toggles.bodyguardRedirectsPoison;
    for (const attack of [...attacks]) {
      if (attack.target !== protectee || attack.via === 'REDIRECT' || !isLive(attack)) continue;
      if (attack.type !== 'WOLF_KILL' && !(redirectsPoison && attack.type === 'POISON')) continue;
      if (healShields.some((h) => h.target === protectee && h.covers(attack))) continue;
      attack.cancelledBy.push(bg.ability.id);
      const moved = addAttack({
        key: `redirect:${attack.key}:${bg.action.id}`,
        target: bg.action.playerId,
        type: attack.type,
        via: 'REDIRECT',
        origin: attack.via,
        actorIds: attack.actorIds,
      });
      if (!protectionsOff) applyShields(protectionShields, [moved]);
      redirects.push({ fromPlayerId: protectee, toPlayerId: bg.action.playerId, attackType: attack.type, abilityInstanceId: bg.ability.id });
    }
  }

  // Step 9: heals. Witch and Doctor saves cancel the attack types they list on their target.
  // Protections-off also skips heals. A lethal those shields would have stopped counts as Chaos success.
  if (protectionsOff) skippedShieldSaved = skippedShieldSaved || shieldWouldStop(healShields);
  else applyShields(healShields, attacks);

  // Step 10: poison. Immediate poison was collected in step 5 and only an ability that lists
  // POISON cancelled it in steps 7 and 9 (OD-28). A delayed poison becomes an effect after step 12.

  // Step 11: Immortal. One charge clears every remaining lethal on that player for this
  // resolution, and is spent only when it does (OD-12).
  const lethalTargets = sortedUnique(attacks.filter(isLive).map((a) => a.target)).filter(alive);
  for (const playerId of lethalTargets) {
    const immortal = abilitiesOf(playerId).find((a) => a.config.capability === 'SURVIVE_DEATH' && a.status === 'ACTIVE' && a.chargesRemaining !== 0);
    if (!immortal) continue;
    for (const attack of attacks) if (attack.target === playerId && isLive(attack)) attack.cancelledBy.push(immortal.id);
    spend(immortal);
  }

  // NO_KILLS: Chaos cancels every attack still live, before deaths.
  if (noKills && chaosAction) {
    const live = attacks.filter(isLive);
    for (const attack of live) attack.cancelledBy.push(chaosAction.ability.id);
    chaosSuccess = live.length > 0;
  }
  if (protectionsOff) chaosSuccess = skippedShieldSaved;

  // Step 12: deaths. A player dies from every attack still live.
  const deaths: Death[] = [];
  for (const playerId of sortedUnique(attacks.map((a) => a.target))) {
    const lethal = attacks.filter((a) => a.target === playerId && isLive(a));
    if (lethal.length === 0 || !alive(playerId)) continue;
    deaths.push({
      playerId,
      causes: lethal.map((a) => a.type),
      attackers: lethal.map((a) => ({ type: a.type, via: a.via, actorIds: a.actorIds })),
      roleIdAtDeath: assignment.get(playerId)?.currentRoleId ?? 'unknown',
    });
  }
  const dead = new Set(deaths.map((d) => d.playerId));
  const aliveAfter = (playerId: PlayerId) => alive(playerId) && !dead.has(playerId);

  // Shields: an item that blocked is spent; one whose holder died is gone (OD-16).
  for (const [effectId, used] of heldShields) {
    const holder = effects.find((e) => e.id === effectId)!.targetPlayerId;
    if (used) closedEffects.set(effectId, 'SPENT');
    else if (!aliveAfter(holder)) closedEffects.set(effectId, 'EXPIRED');
  }
  for (const item of items.values()) {
    const holder = item.accepted.action.targetPlayerIds[0]!;
    if (item.used || !aliveAfter(holder)) continue;
    newEffects.push({
      kind: 'SHIELD',
      sourcePlayerId: item.accepted.action.playerId,
      sourceAbilityInstanceId: item.accepted.ability.id,
      targetPlayerId: holder,
      createdRound: round,
      dueRound: null,
      duePhase: null,
      attackTypes: protectionCancels(item.accepted.def),
    });
  }

  // Delayed poison (OD-28): a POISON cure on the victim tonight stops it; otherwise it lands later.
  for (const p of of('ATTACK')) {
    const delay = p.def.config['delay'];
    if (p.def.capability !== 'POISON' || delay === undefined) continue;
    const target = p.action.targetPlayerIds[0]!;
    const probe: Attack = { key: `poison:${p.action.id}`, target, type: 'POISON', via: 'ABILITY', origin: 'ABILITY', actorIds: [p.action.playerId], cancelledBy: [] };
    if (!protectionsOff) applyShields([...protectionShields.filter((s) => !s.onCancel), ...healShields], [probe]);
    if (!isLive(probe)) {
      attacks.push(probe);
      continue;
    }
    if (!aliveAfter(target)) continue;
    newEffects.push({
      kind: 'POISON',
      sourcePlayerId: p.action.playerId,
      sourceAbilityInstanceId: p.ability.id,
      targetPlayerId: target,
      createdRound: round,
      dueRound: delay === 'NEXT_DAWN' ? round + 1 : round,
      duePhase: delay === 'NEXT_DAWN' ? 'NIGHT' : 'DAY',
      attackTypes: ['POISON'],
    });
  }

  // Step 13: infection, after deaths, so only survivors convert (OD-03).
  const infections = opened.filter((a) => a.step === 'INFECTION');
  for (const extra of infections.slice(config.infection.attemptsPerNight)) reject(extra.action, 'NOT_IMPLEMENTED');
  const attempt = infections[0];
  let successes = input.infection.successes;
  let sealed = input.infection.sealed;
  let infection: InfectionOutcome | null = null;
  const conversions: Conversion[] = [];
  const grants: AbilityGrant[] = [];
  const revocations: AbilityUpdate[] = [];
  const converted = new Set<PlayerId>();
  const livingPack = () =>
    input.assignments.filter((a) => (a.currentFaction === 'WOLF_PACK' || converted.has(a.playerId)) && aliveAfter(a.playerId)).length;
  const convert = (playerId: PlayerId, cause: Conversion['cause']) => {
    const result = convertToInfectedWolf(input, catalog, playerId, assignment.get(playerId)!, cause);
    conversions.push(result.conversion);
    grants.push(...result.grants);
    revocations.push(...result.revocations);
    converted.add(playerId);
  };
  if (attempt) {
    const actorId = attempt.action.playerId;
    const targetId = attempt.action.targetPlayerIds[0]!;
    const reason = isBlocked(attempt) ? 'BLOCKED' : infectionFailure(input, catalog, actorId, targetId, aliveAfter, successes, sealed, assignment, livingPack());
    infection = { actionId: attempt.action.id, actorId, targetId, outcome: reason ? 'FAILED' : 'SUCCESS', reason };
    if (!reason) {
      successes += 1;
      convert(targetId, 'INFECTION');
    }
  }
  // The Alpha's death seals infection for the rest of the game (C-09), whenever it happens.
  for (const d of deaths) if (input.abilities.some((a) => a.playerId === d.playerId && a.config.capability === 'INFECT')) sealed = true;

  // Step 14: Cursed. A wolf attack that happened and did not kill converts, if the pack has room.
  // Protection, a trap, a heal, Immortal, or a Bodyguard taking the hit all count as survived (OD-06).
  const cursedFailures: CursedFailure[] = [];
  const cursed = input.abilities
    .filter((a) => a.config.handlerKey === 'cursed.onSurvivedWolfAttack' && a.status === 'ACTIVE' && a.chargesRemaining !== 0)
    .sort((a, b) => byString(a.playerId, b.playerId));
  for (const ability of cursed) {
    const playerId = ability.playerId;
    const attacked = attacks.some((a) => a.target === playerId && a.type === 'WOLF_KILL');
    if (!attacked || !aliveAfter(playerId) || converted.has(playerId) || isPack(playerId)) continue;
    if (livingPack() >= config.teams.wolfCap) {
      cursedFailures.push({ playerId, reason: 'CAP_SIZE' });
      continue;
    }
    spend(ability);
    convert(playerId, 'CURSED');
  }

  // Vampire marks land tonight and come due two nights later. A due mark converts only when both live.
  for (const mark of of('CONVERT')) {
    newEffects.push({
      kind: 'VAMPIRE_MARK',
      sourcePlayerId: mark.action.playerId,
      sourceAbilityInstanceId: mark.ability.id,
      targetPlayerId: mark.action.targetPlayerIds[0]!,
      createdRound: round,
      dueRound: round + 2,
      duePhase: 'NIGHT',
      attackTypes: [],
    });
  }
  for (const effect of effects) {
    if (effect.kind !== 'VAMPIRE_MARK' || effect.dueRound === null || effect.dueRound > round) continue;
    const target = assignment.get(effect.targetPlayerId);
    const ready = !!target && aliveAfter(effect.sourcePlayerId) && aliveAfter(effect.targetPlayerId) && !converted.has(effect.targetPlayerId) && target.currentFaction !== 'WOLF_PACK';
    if (!ready || !target) {
      closedEffects.set(effect.id, 'EXPIRED');
      continue;
    }
    const result = convertToVampireServant(input, catalog, effect.targetPlayerId, target);
    conversions.push(result.conversion);
    revocations.push(...result.revocations);
    converted.add(effect.targetPlayerId);
    closedEffects.set(effect.id, 'SPENT');
  }

  // Step 18 runs here for accepted actions, because inheritance below hands over the charges a
  // Doctor has left after tonight. Accepted actions spend their use, including redundant savers
  // (OD-48); an illegal target left in place spends the attempt (section 7); a blocked action and
  // an untriggered trap spend nothing.
  for (const a of accepted) if (!outcomes.has(a.action.id)) outcomes.set(a.action.id, { actionId: a.action.id, status: 'RESOLVED', reason: null });
  for (const a of [...accepted, ...spentOnIllegal]) {
    const reason = outcomes.get(a.action.id)?.reason;
    if (reason === 'NOT_IMPLEMENTED' || reason === 'BLOCKED' || reason === 'SUPERSEDED' || reason === 'REWOUND') continue;
    if (untriggeredTraps.has(a.action.id)) continue;
    spend(a.ability, a.action.targetPlayerIds);
    const group = exclusiveGroupOf(a.ability.config);
    if (group?.startsWith('mimic:')) {
      for (const other of abilitiesOf(a.ability.playerId)) {
        if (other.id === a.ability.id || exclusiveGroupOf(other.config) !== group || other.status === 'REVOKED') continue;
        updates.set(other.id, { status: 'REVOKED', revokedReason: 'MIMIC_USED' });
      }
    }
  }

  // Step 15: other conversions. A Shapeshifter's copy is granted for the next night with fresh
  // charges (OD-31), and a Healer Assistant takes over a Doctor who died or converted tonight (OD-32).
  const copies: Copy[] = [];
  for (const c of of('COPY')) {
    const actorId = c.action.playerId;
    const targetId = c.action.targetPlayerIds[0]!;
    const targetAbilities = abilitiesOf(targetId);
    const standIn = targetAbilities.some((a) => a.config.capability === 'ROLE_COPY' || (a.source ?? 'NATIVE') === 'COPY');
    const copied = !aliveAfter(actorId) || converted.has(actorId) || standIn ? [] : targetAbilities.filter((a) => a.status === 'ACTIVE' && (a.source ?? 'NATIVE') === 'NATIVE' && copyable(a.config, toggles.copyInformedDoctor));
    const nights = typeof c.def.config['durationNights'] === 'number' ? c.def.config['durationNights'] : 1;
    const oneCharge = c.def.config['copyCharges'] === true;
    const untilUsed = c.def.config['untilUsed'] === true;
    const mimicGroup = oneCharge ? `mimic:${c.action.id}` : null;
    for (const a of copied) {
      grants.push({
        playerId: actorId,
        abilityId: a.config.id,
        definition: mimicGroup ? { ...a.config, usesPerGame: 1, config: { ...a.config.config, exclusiveGroup: mimicGroup } } : a.config,
        chargesRemaining: oneCharge ? 1 : a.config.usesPerGame,
        availableFromRound: Math.max(round + 1, a.config.availableFromRound),
        expiresRound: untilUsed ? null : round + nights,
        source: 'COPY',
        sourcePlayerId: targetId,
      });
    }
    copies.push({ actionId: c.action.id, actorId, targetId, abilityIds: copied.map((a) => a.config.id) });
  }

  const inheritances: Inheritance[] = [];
  const inheritedFrom = new Set<PlayerId>();
  const assistants = input.abilities.filter((a) => a.config.handlerKey === 'assistant.inheritDoctor' && a.status === 'ACTIVE' && a.chargesRemaining !== 0).sort(byId);
  for (const assistant of assistants) {
    const heir = assistant.playerId;
    const roleId = assistant.config.config['inheritsRoleId'];
    if (!aliveAfter(heir) || converted.has(heir) || typeof roleId !== 'string') continue;
    const doctor = input.assignments
      .filter((a) => a.currentRoleId === roleId && (dead.has(a.playerId) || converted.has(a.playerId)) && !inheritedFrom.has(a.playerId))
      .sort((a, b) => byString(a.playerId, b.playerId))[0];
    if (!doctor) continue;
    const inherited = abilitiesOf(doctor.playerId).filter((a) => (a.source ?? 'NATIVE') === 'NATIVE' && a.status !== 'REVOKED');
    for (const a of inherited) {
      const after = updates.get(a.id);
      grants.push({
        playerId: heir,
        abilityId: a.config.id,
        definition: a.config,
        // OD-32: whatever the Doctor has left after tonight. Not reset, not duplicated.
        chargesRemaining: after && 'chargesRemaining' in after ? (after.chargesRemaining ?? null) : a.chargesRemaining,
        availableFromRound: round + 1,
        expiresRound: null,
        source: 'INHERITED',
        sourcePlayerId: doctor.playerId,
      });
    }
    inheritedFrom.add(doctor.playerId);
    spend(assistant);
    inheritances.push({ playerId: heir, fromPlayerId: doctor.playerId, abilityIds: inherited.map((a) => a.config.id) });
  }

  // Step 16: death triggers. An Avenger killed tonight by one named player queues revenge for the
  // next night. A pack kill names nobody while wolves are anonymous, so it spends the revenge (OD-13).
  const revenges: Revenge[] = [];
  for (const death of deaths) {
    const avenger = abilitiesOf(death.playerId).find((a) => a.config.capability === 'REVENGE' && a.status === 'ACTIVE' && a.chargesRemaining !== 0);
    if (!avenger) continue;
    const lethal = attacks.filter((a) => a.target === death.playerId && isLive(a));
    const anonymous = lethal.some((a) => a.via === 'PACK' || a.origin === 'PACK');
    const named = sortedUnique(lethal.flatMap((a) => a.actorIds)).filter((id) => id !== death.playerId);
    const targetId = !anonymous && named.length === 1 && aliveAfter(named[0]!) ? named[0]! : null;
    spend(avenger);
    revenges.push({ avengerId: death.playerId, targetId });
    if (targetId) {
      newEffects.push({
        kind: 'REVENGE',
        sourcePlayerId: death.playerId,
        sourceAbilityInstanceId: avenger.id,
        targetPlayerId: targetId,
        createdRound: round,
        dueRound: round + 1,
        duePhase: 'NIGHT',
        attackTypes: [avenger.config.attackType ?? 'REVENGE'],
      });
    }
  }

  // The Assassin's night-1 mark is written on the assignment (OD-09).
  const marks: Mark[] = of('MARK').map((m) => ({ playerId: m.action.playerId, targetId: m.action.targetPlayerIds[0]! }));

  const silences: Silence[] = of('SILENCE').map((s) => ({ actionId: s.action.id, actorId: s.action.playerId, targetId: s.action.targetPlayerIds[0]! }));
  const revivals: Revival[] = [];
  for (const revival of of('REVIVE')) {
    const targetId = revival.action.targetPlayerIds[0]!;
    revivals.push({ actionId: revival.action.id, actorId: revival.action.playerId, targetId });
    newEffects.push({
      kind: 'RETURNED',
      sourcePlayerId: revival.action.playerId,
      sourceAbilityInstanceId: revival.ability.id,
      targetPlayerId: targetId,
      createdRound: round,
      dueRound: round + 1,
      duePhase: 'NIGHT',
      attackTypes: [],
    });
  }
  const hints: Hint[] = [];
  for (const hint of of('HINT')) {
    const text = hint.action.payload['hint'];
    if (typeof text !== 'string' || text.length === 0) continue;
    hints.push({ actionId: hint.action.id, actorId: hint.action.playerId, text });
  }
  for (const effect of effects) {
    if (effect.kind === 'RETURNED' && effect.dueRound !== null && effect.dueRound <= round) closedEffects.set(effect.id, 'SPENT');
  }
  if (chaos && chaosAction && (chaos.kind === 'NO_VOTE' || chaos.kind === 'SWAP_VOTES' || chaos.kind === 'DOUBLE_VOTE')) {
    chaosSuccess = null;
    newEffects.push({
      kind: 'CHAOS_DAY',
      sourcePlayerId: chaosAction.action.playerId,
      sourceAbilityInstanceId: chaosAction.ability.id,
      targetPlayerId: chaos.playerIds[0] ?? chaosAction.action.playerId,
      createdRound: round,
      dueRound: round,
      duePhase: 'DAY',
      attackTypes: [],
      chaosKind: chaos.kind,
      playerIds: [...chaos.playerIds],
    });
  }
  const chaosEvent: ChaosEvent | null = chaos && chaosAction
    ? { actorId: chaosAction.action.playerId, kind: chaos.kind, playerIds: [...chaos.playerIds], success: chaosSuccess }
    : null;

  // A role lost tonight still resolved tonight's action first (game-rules.md, "Role lost the same night").
  for (const r of revocations) updates.set(r.abilityInstanceId, { ...updates.get(r.abilityInstanceId), ...r.patch });

  const saves = new Map<string, { playerId: PlayerId; attackType: AttackType; savedBy: AbilityInstanceId[] }>();
  for (const attack of attacks) {
    for (const by of attack.cancelledBy) {
      const key = `${attack.target}|${attack.type}`;
      const save = saves.get(key) ?? { playerId: attack.target, attackType: attack.type, savedBy: [] };
      if (!save.savedBy.includes(by)) save.savedBy.push(by);
      saves.set(key, save);
    }
  }

  return {
    round,
    finalWolfTarget,
    deaths,
    saves: [...saves.values()].map((s) => ({ ...s, savedBy: [...s.savedBy] })),
    redirects,
    blocks,
    investigations: investigations.sort((a, b) => byString(a.actionId, b.actionId)),
    infection,
    conversions,
    cursedFailures,
    copies,
    inheritances,
    revenges,
    marks,
    rewinds,
    chaosEvent,
    silences,
    revivals,
    hints,
    grants,
    abilityUpdates: [...updates.entries()].sort(([a], [b]) => byString(a, b)).map(([abilityInstanceId, patch]) => ({ abilityInstanceId, patch })),
    newEffects,
    closedEffects: [...closedEffects.entries()].sort(([a], [b]) => byString(a, b)).map(([effectId, status]) => ({ effectId, status })),
    actions: input.actions.map((a) => outcomes.get(a.id)!).sort((a, b) => byString(a.actionId, b.actionId)),
    infectionState: { successes, sealed },
    publicFacts: {
      deaths: deaths.map((d) => ({ playerId: d.playerId, revealedRoleId: config.voting.revealOnNightDeath === 'CURRENT_ROLE' ? d.roleIdAtDeath : null })),
      infectionAnnounced: config.infection.announcement === 'PUBLIC' && infection?.outcome === 'SUCCESS',
      hints: hints.map((hint) => ({ text: hint.text })),
      silenced: silences.map((silence) => silence.targetId),
      returned: revivals.map((revival) => revival.targetId),
    },
  };
}

/**
 * OD-31 and OD-58: what a Shapeshifter may copy. Only abilities a player
 * submits; never infection, another copy ability, or the informed Doctor's
 * veto unless the configuration allows it.
 */
function copyable(def: AbilityDefinition, copyInformedDoctor: boolean): boolean {
  if (def.timing === 'PASSIVE' || !handlerFor(def, DEFAULT_CAPABILITY_REGISTRY)?.submittable) return false;
  if (def.config['actsWhileDead'] === true) return false;
  if (def.capability === 'INFECT' || def.capability === 'ROLE_COPY') return false;
  return def.target.kind !== 'FINAL_WOLF_TARGET' || copyInformedDoctor;
}

/**
 * Step 4 (night-resolution.md, section 3). Host select uses only a confirmed
 * player who appears in a submission and is alive; it never invents one.
 * Majority takes a unique maximum, and a tie is no kill. Alpha priority takes
 * the Alpha's submission, or the majority of the rest when the Alpha sent none.
 * Friendly fire off removes pack members from the legal set.
 */
function aggregatePackKill(
  input: NightInput,
  packKills: readonly Accepted[],
  life: ReadonlyMap<PlayerId, LifeStatus>,
  isPack: (playerId: PlayerId) => boolean,
): PlayerId | null {
  const legal = (target: PlayerId) => life.get(target) === 'ALIVE' && (input.config.wolves.friendlyFire || !isPack(target));
  const submitted = packKills.map((a) => a.action.targetPlayerIds[0]!).filter(legal);

  const majority = (targets: readonly PlayerId[]): PlayerId | null => {
    const counts = new Map<PlayerId, number>();
    for (const t of targets) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = Math.max(0, ...counts.values());
    const leaders = [...counts.entries()].filter(([, n]) => n === top);
    return leaders.length === 1 ? leaders[0]![0] : null;
  };

  switch (input.config.wolves.killAggregation) {
    case 'HOST_SELECT_AMONG_SUBMISSIONS': {
      const decision = input.hostDecision;
      return decision?.kind === 'TARGET' && submitted.includes(decision.playerId) ? decision.playerId : null;
    }
    case 'MAJORITY':
      return majority(submitted);
    case 'ALPHA_PRIORITY': {
      const alpha = packKills.find((a) => input.abilities.some((ab) => ab.playerId === a.action.playerId && ab.config.capability === 'INFECT'));
      const alphaTarget = alpha?.action.targetPlayerIds[0];
      return alphaTarget && legal(alphaTarget) ? alphaTarget : majority(submitted);
    }
  }
}

/** Section 6 preconditions, in the documented order. Null means the infection converts. */
function infectionFailure(
  input: NightInput,
  catalog: RoleCatalog,
  actorId: PlayerId,
  targetId: PlayerId,
  aliveAfter: (playerId: PlayerId) => boolean,
  successes: number,
  sealed: boolean,
  assignment: ReadonlyMap<PlayerId, NightAssignment>,
  livingPack: number,
): InfectionFailure | null {
  const { infection, teams } = input.config;
  if (!infection.enabled) return 'DISABLED';
  if (sealed) return 'SEALED';
  if (!aliveAfter(actorId)) return 'ALPHA_DEAD';
  if (successes >= infection.maxSuccesses) return 'CAP_SUCCESS';
  if (livingPack >= teams.wolfCap) return 'CAP_SIZE';
  if (!aliveAfter(targetId)) return 'TARGET_DEAD';

  const target = assignment.get(targetId);
  const role = target ? catalog.byId.get(target.currentRoleId) : undefined;
  if (!target || !role || role.infection.whenTarget === 'INELIGIBLE' || target.currentFaction === 'WOLF_PACK') return 'TARGET_INELIGIBLE';
  if (infection.eligibility === 'VILLAGE_ONLY' && target.currentFaction !== 'VILLAGE') return 'TARGET_INELIGIBLE';
  return null;
}

/**
 * Section 6, "Result", shared by infection and the Cursed conversion: the
 * player becomes an Infected Wolf. Abilities lost on infection and every
 * copied ability are revoked (OD-58), the kill is granted from the next night
 * (C-06), and an individual victory tied to the lost role is revoked.
 */
function convertToInfectedWolf(
  input: NightInput,
  catalog: RoleCatalog,
  playerId: PlayerId,
  from: NightAssignment,
  cause: Conversion['cause'],
): { conversion: Conversion; grants: AbilityGrant[]; revocations: AbilityUpdate[] } {
  const infected = catalog.byId.get('infected_wolf');
  const profile = infected?.profiles[infected.defaultProfileId];
  if (!infected || !profile) throw new Error('The catalog has no infected_wolf role');

  const lostRole = catalog.byId.get(from.currentRoleId);
  const lostVictory = lostRole?.profiles[from.currentProfileId]?.victory;
  const revocations: AbilityUpdate[] = input.abilities
    .filter((a) => a.playerId === playerId && a.status !== 'REVOKED' && (a.config.lostOnInfection || (a.source ?? 'NATIVE') === 'COPY'))
    .sort(byId)
    .map((a) => ({ abilityInstanceId: a.id, patch: { status: 'REVOKED' as const, revokedReason: cause } }));
  const grants: AbilityGrant[] = input.config.infection.grantKillNextNight
    ? profile.abilities.map((definition) => ({
        playerId,
        abilityId: definition.id,
        definition,
        chargesRemaining: definition.usesPerGame,
        availableFromRound: input.round + 1,
        expiresRound: null,
        source: 'NATIVE' as const,
        sourcePlayerId: null,
      }))
    : [];

  return {
    conversion: {
      playerId,
      fromRoleId: from.currentRoleId,
      fromFaction: from.currentFaction,
      toRoleId: infected.id,
      toProfileId: profile.id,
      toFaction: 'WOLF_PACK',
      wolfAligned: true,
      individualVictory: lostVictory?.type === 'INDIVIDUAL' ? 'REVOKED' : null,
      cause,
    },
    grants,
    revocations,
  };
}

/** A due Vampire mark. The target becomes a Servant and loses the abilities infection would take. */
function convertToVampireServant(
  input: NightInput,
  catalog: RoleCatalog,
  playerId: PlayerId,
  from: NightAssignment,
): { conversion: Conversion; revocations: AbilityUpdate[] } {
  const servant = catalog.byId.get('vampire_servant');
  const profile = servant?.profiles[servant.defaultProfileId];
  if (!servant || !profile) throw new Error('The catalog has no vampire_servant role');
  const lostVictory = catalog.byId.get(from.currentRoleId)?.profiles[from.currentProfileId]?.victory;
  const revocations: AbilityUpdate[] = input.abilities
    .filter((a) => a.playerId === playerId && a.status !== 'REVOKED' && (a.config.lostOnInfection || (a.source ?? 'NATIVE') === 'COPY'))
    .sort(byId)
    .map((a) => ({ abilityInstanceId: a.id, patch: { status: 'REVOKED' as const, revokedReason: 'VAMPIRE' } }));
  return {
    conversion: {
      playerId,
      fromRoleId: from.currentRoleId,
      fromFaction: from.currentFaction,
      toRoleId: servant.id,
      toProfileId: profile.id,
      toFaction: 'NEUTRAL',
      wolfAligned: false,
      individualVictory: lostVictory?.type === 'INDIVIDUAL' ? 'REVOKED' : null,
      cause: 'VAMPIRE',
    },
    revocations,
  };
}
