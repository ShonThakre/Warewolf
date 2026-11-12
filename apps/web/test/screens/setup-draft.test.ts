import { getPack, validateConfiguration } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import {
  applyMode,
  applyPack,
  basePackOf,
  configurationFromPack,
  hasHandEdits,
  roleSummary,
  seatAlphaWolf,
  setInfectionEnabled,
  setRequiresSurvival,
  toCustom,
  infectionLocked,
  roleCount,
  setAbilityCharge,
  setAbilityConfig,
  setPlayerCount,
  setRoleCount,
  setWolfCap,
} from '../../src/game/setup/setupDraft';

const infection = configurationFromPack('infection-core');
const classic = configurationFromPack('classic-10');

describe('setup drafts', () => {
  it('locks Infection Edition against role and player edits', () => {
    expect(infection).toBeTruthy();
    expect(infectionLocked(infection!)).toBe(true);
    expect(setRoleCount(infection!, 'normal_villager', 13)).toBe(infection);
    expect(setPlayerCount(infection!, 10)).toBe(infection);
    expect(setAbilityCharge(infection!, 'doctor', 'doctor_save', 1)).toBe(infection);
    expect(roleCount(infection!, 'normal_villager')).toBe(14);
    expect(infection!.playerCount).toBe(20);
  });

  it('turns a preset into a custom list when a role count changes', () => {
    const next = setRoleCount(classic!, 'normal_villager', 7);
    expect(next.rolePackId).toBe('custom');
    expect(next.mode).toBe('CLASSIC');
    expect(roleCount(next, 'normal_villager')).toBe(7);
    expect(setRoleCount(next, 'confuser', 1)).toBe(next);
    expect(setRoleCount(next, 'infected_wolf', 1)).toBe(next);
    expect(roleCount(next, 'confuser')).toBe(0);
  });

  it('clamps the player count to the mode and restores a pack from its id', () => {
    expect(setPlayerCount(classic!, 3).playerCount).toBe(6);
    expect(setPlayerCount(classic!, 40).playerCount).toBe(20);
    const custom = setPlayerCount(classic!, 12);
    expect(custom.rolePackId).toBe('custom');
    const restored = applyPack(custom, 'classic-10');
    expect(restored.rolePackId).toBe('classic-10');
    expect(restored.playerCount).toBe(getPack('classic-10')?.config.playerCount);
    expect(applyMode(restored, 'INFECTION').mode).toBe('INFECTION');
  });

  it('edits an existing toggle and refuses a key the ability does not have', () => {
    const withGuard = setRoleCount(classic!, 'bodyguard', 1);
    const toggled = setAbilityConfig(withGuard, 'bodyguard', 'bodyguard_protect', 'redirectToSelf', false);
    const override = toggled.roles.find((entry) => entry.roleId === 'bodyguard')?.overrides?.['bodyguard_protect'];
    expect(override?.config?.redirectToSelf).toBe(false);
    expect(setAbilityConfig(toggled, 'bodyguard', 'bodyguard_protect', 'freeText', true)).toBe(toggled);
    const charged = setAbilityCharge(classic!, 'doctor', 'doctor_save', 1);
    expect(charged.roles.find((entry) => entry.roleId === 'doctor')?.overrides?.['doctor_save']?.usesPerGame).toBe(1);
  });

  it('raises the wolf cap to the wolves dealt at the start', () => {
    const custom = configurationFromPack('custom');
    expect(custom?.teams.wolfCap).toBe(0);
    const one = setRoleCount(custom!, 'pack_wolf', 1);
    expect(one.teams.wolfCap).toBe(1);
    const two = setRoleCount(one, 'pack_wolf', 2);
    expect(two.teams.wolfCap).toBe(2);
    const back = setRoleCount(two, 'pack_wolf', 1);
    expect(back.teams.wolfCap).toBe(2);
    expect(setWolfCap(one, 0).teams.wolfCap).toBe(1);
    expect(setWolfCap(one, 4).teams.wolfCap).toBe(4);
  });

  it('ignores a click on the current mode, so edits survive', () => {
    const edited = setRoleCount(classic!, 'normal_villager', 7);
    expect(applyMode(edited, 'CLASSIC')).toBe(edited);
    expect(applyMode(infection!, 'INFECTION')).toBe(infection);
  });

  it('carries the current roles and rules into Custom', () => {
    const edited = setRoleCount(classic!, 'normal_villager', 7);
    const custom = applyMode(edited, 'CUSTOM');
    expect(custom.mode).toBe('CUSTOM');
    expect(custom.rolePackId).toBe('custom');
    expect(custom.roles).toEqual(edited.roles);
    expect(custom.playerCount).toBe(edited.playerCount);
    expect(custom.wolves).toEqual(edited.wolves);
    expect(validateConfiguration(custom).errors.map((issue) => issue.code)).toEqual(validateConfiguration(edited).errors.map((issue) => issue.code));
    // A locked roster becomes an editable copy.
    const fromInfection = applyMode(infection!, 'CUSTOM');
    expect(roleCount(fromInfection, 'alpha_wolf')).toBe(1);
    expect(setRoleCount(fromInfection, 'normal_villager', 13)).not.toBe(fromInfection);
  });

  it('clamps the carried player count to Custom bounds', () => {
    expect(toCustom({ ...classic!, playerCount: 4 }).playerCount).toBe(6);
    expect(toCustom({ ...classic!, playerCount: 40 }).playerCount).toBe(30);
  });

  it('knows when loading a preset would lose a hand-made list', () => {
    expect(hasHandEdits(classic!)).toBe(false);
    expect(hasHandEdits(infection!)).toBe(false);
    expect(hasHandEdits(setRoleCount(classic!, 'normal_villager', 7))).toBe(true);
    expect(hasHandEdits(configurationFromPack('custom')!)).toBe(false);
  });

  it('finds the preset an edited setup came from', () => {
    expect(basePackOf(classic!)?.id).toBe('classic-10');
    const investigation = configurationFromPack('investigation-15')!;
    expect(basePackOf(setRoleCount(investigation, 'normal_villager', 9))?.id).toBe('investigation-15');
    const unrelated = { ...classic!, rolePackId: 'custom', roles: [] };
    expect(basePackOf(unrelated)?.id).toBe('classic-10');
    expect(basePackOf(toCustom(classic!))).toBeNull();
  });

  it('summarises roles wolves first, then village, with open seats', () => {
    expect(roleSummary(classic!)).toBe('2 Pack Wolf · 1 Seeker · 1 Doctor · 6 Villager');
    expect(roleSummary(setPlayerCount(classic!, 12))).toBe('2 Pack Wolf · 1 Seeker · 1 Doctor · 6 Villager · 2 seats open');
    expect(roleSummary(configurationFromPack('custom')!)).toBe('10 seats open');
    expect(roleSummary(setRoleCount(classic!, 'normal_villager', 7))).toBe('2 Pack Wolf · 1 Seeker · 1 Doctor · 7 Villager · 1 more than the 10 seats');
  });

  it('settles OD-03 when infection is turned on, and drops it when turned off', () => {
    const on = setInfectionEnabled(classic!, true);
    expect(on.rulesetAcknowledgments['OD-03']).toBe('SURVIVAL_REQUIRED');
    expect(validateConfiguration(on).errors.map((issue) => issue.code)).not.toContain('DECISION_UNSET');
    const off = setInfectionEnabled(on, false);
    expect('OD-03' in off.rulesetAcknowledgments).toBe(false);
    expect(setInfectionEnabled(infection!, false)).toBe(infection);
  });

  it('records the survival choice as the OD-03 acknowledgement', () => {
    const convert = setRequiresSurvival(setInfectionEnabled(classic!, true), false);
    expect(convert.infection.requiresSurvival).toBe(false);
    expect(convert.rulesetAcknowledgments['OD-03']).toBe('CONVERT_BEFORE_DEATH');
    expect(validateConfiguration(convert).errors.map((issue) => issue.code)).not.toContain('DECISION_MISMATCH');
    // A draft saved before the fix (infection on, no acknowledgement) is settled by picking the shown rule.
    const unsettled = { ...classic!, infection: { ...classic!.infection, enabled: true }, rulesetAcknowledgments: {} };
    expect(setRequiresSurvival(unsettled, true).rulesetAcknowledgments['OD-03']).toBe('SURVIVAL_REQUIRED');
  });

  it('seats an Alpha Wolf in a Villager seat for infection', () => {
    const seated = seatAlphaWolf(setInfectionEnabled(classic!, true));
    expect(roleCount(seated, 'alpha_wolf')).toBe(1);
    expect(roleCount(seated, 'normal_villager')).toBe(5);
    expect(seated.roles.reduce((sum, entry) => sum + entry.count, 0)).toBe(seated.playerCount);
    const codes = validateConfiguration(seated).errors.map((issue) => issue.code);
    expect(codes).not.toContain('INFECTION_WITHOUT_ALPHA');
    expect(codes).not.toContain('DECISION_UNSET');
    expect(seatAlphaWolf(seated)).toBe(seated);
    expect(seatAlphaWolf(infection!)).toBe(infection);
  });
});
