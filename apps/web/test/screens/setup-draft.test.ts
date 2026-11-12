import { getPack } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import {
  applyMode,
  applyPack,
  configurationFromPack,
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
});
