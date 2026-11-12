import { GAME_PHASES } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import { INFECTION_CLOSES } from '../../src/game/fixtures/phase';
import { PHASE_LABEL, closeButtonLabel, closeConsequence, closeNeedsConfirm, phaseGuide, formatCountdown, guestActionCopy, lifeLabel, roundLabel } from '../../src/game/components/phaseCopy';

describe('phase copy', () => {
  it('names every phase in words', () => {
    for (const phase of GAME_PHASES) expect(PHASE_LABEL[phase].length).toBeGreaterThan(0);
    expect(PHASE_LABEL.NIGHT_SUBMIT).toBe('Night');
    expect(PHASE_LABEL.ROLE_REVEAL).toBe('Role reveal');
    expect(roundLabel(2)).toBe('Round 2');
  });

  it('labels each Infection Edition close, and a Classic night', () => {
    expect(closeButtonLabel(INFECTION_CLOSES.ROLE_REVEAL!)).toBe('Begin the night');
    expect(closeButtonLabel(INFECTION_CLOSES.NIGHT_SUBMIT!)).toBe('Close night actions');
    expect(closeButtonLabel(INFECTION_CLOSES.NIGHT_HOST_CONFIRM!)).toBe('Open reactions');
    expect(closeButtonLabel(INFECTION_CLOSES.NIGHT_REACTION!)).toBe('Resolve night');
    expect(closeButtonLabel(INFECTION_CLOSES.DAY_ANNOUNCE!)).toBe('Continue to day');
    expect(closeButtonLabel(INFECTION_CLOSES.DAY_DISCUSSION!)).toBe('Open voting');
    expect(closeButtonLabel({ next: null, resolves: 'DAY' }, 'DAY_DISCUSSION')).toBe('Resolve the shot');
    expect(closeButtonLabel({ next: null, resolves: 'DAY' }, 'VOTING')).toBe('End the day');
    expect(closeButtonLabel(INFECTION_CLOSES.VOTING!)).toBe('End the day');
    expect(closeButtonLabel(INFECTION_CLOSES.REVOTE!)).toBe('End the day');
    expect(closeButtonLabel({ next: null, resolves: 'NIGHT' })).toBe('Resolve night');
  });

  it('formats a clock and the guest line', () => {
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(59)).toBe('0:59');
    expect(lifeLabel('ALIVE')).toBe('Alive');
    expect(lifeLabel('DEAD')).toBe('Eliminated');
    expect(guestActionCopy({ status: 'ACTIVE', phaseEndsAt: null })).toBe('Waiting for host');
    expect(guestActionCopy({ status: 'ACTIVE', phaseEndsAt: '2026-11-11T20:01:30.000Z' })).toBe('The timer closes this phase.');
    expect(guestActionCopy({ status: 'CANCELLED', phaseEndsAt: null })).toMatch(/cancelled/i);
  });
});

describe('host close guidance', () => {
  it('confirms a close that resolves or ends a choosing window, and not routine navigation', () => {
    expect(closeNeedsConfirm({ next: null, resolves: 'NIGHT' }, 'NIGHT_SUBMIT')).toBe(true);
    expect(closeNeedsConfirm({ next: null, resolves: 'DAY' }, 'VOTING')).toBe(true);
    expect(closeNeedsConfirm({ next: 'NIGHT_HOST_CONFIRM', resolves: null }, 'NIGHT_SUBMIT')).toBe(true);
    expect(closeNeedsConfirm({ next: 'NIGHT_SUBMIT', resolves: null }, 'ROLE_REVEAL')).toBe(false);
    expect(closeNeedsConfirm({ next: 'DAY_DISCUSSION', resolves: null }, 'DAY_ANNOUNCE')).toBe(false);
  });

  it('names what each close does', () => {
    expect(closeConsequence({ next: null, resolves: 'DAY' }, 'VOTING')).toContain('A tie opens a revote');
    expect(closeConsequence({ next: null, resolves: 'DAY' }, 'REVOTE')).toContain('nobody is eliminated');
    expect(closeConsequence({ next: 'NIGHT_SUBMIT', resolves: null }, 'ROLE_REVEAL')).toBe('Starts the night. Players with night abilities choose in secret.');
    for (const phase of GAME_PHASES) expect(phaseGuide(phase).length).toBeGreaterThan(0);
  });
});
