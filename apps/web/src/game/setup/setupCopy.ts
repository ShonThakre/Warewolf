import type { GameMode } from '@warewolf/domain';
import type { SetupStep } from './setupDraft';

/** Shown when a mode refuses host edits. Null for modes the host can change. */
export function lockedModeCopy(mode: GameMode): string | null {
  if (mode === 'INFECTION') {
    return 'Infection Edition is locked at 20 players: 1 Alpha Wolf, 2 Seekers, 1 Guard, 1 Doctor, 1 Witch, and 14 Villagers. Infection stays silent, wolves do not know each other, and friendly fire is on. Choose another mode to edit the setup.';
  }
  if (mode === 'ULTIMATE_20') {
    return 'Ultimate 20 is locked at 20 players: 15 special roles and 5 Villagers. Infection stays silent, wolves do not know each other, friendly fire is off, the Alpha’s target is the kill, and protection does not stop poison. Choose another mode to edit the setup.';
  }
  return null;
}

export const STEP_LABEL: Record<SetupStep, string> = {
  mode: 'Mode and players',
  roles: 'Roles',
  settings: 'Settings',
  review: 'Review',
};

export const PACK_STATUS_LABEL = {
  CONFIRMED: 'Confirmed',
  RECOMMENDED: 'Recommended',
  RECONSTRUCTION: 'Playtest reconstruction',
  BLOCKED: 'Blocked',
  TEMPLATE: 'Empty start',
} as const;

export const KILL_LABEL = {
  HOST_SELECT_AMONG_SUBMISSIONS: 'The host picks among the submitted targets',
  MAJORITY: 'The majority of the submitted targets',
  ALPHA_PRIORITY: "The Alpha Wolf's target breaks a tie",
} as const;

export const ACK_LABEL: Record<string, string> = {
  HOST_SELECT_AMONG_SUBMISSIONS: 'The host picks among the submitted targets',
  MAJORITY: 'The majority of the submitted targets',
  ALPHA_PRIORITY: "The Alpha Wolf's target breaks a tie",
  INFORMED_VETO: 'The Doctor is told the target',
  BLIND_TARGET: 'The Doctor picks without being told',
  SURVIVAL_REQUIRED: 'Infection counts only if the player survives the night',
  CONVERT_BEFORE_DEATH: 'Infection converts the player even if they die that night',
};

export const NIGHT_TOGGLE_LABEL = {
  protectionBlocksPoison: 'Protection stops poison',
  bodyguardRedirectsPoison: 'A bodyguard sends poison to someone else',
  copyInformedDoctor: 'A copied Doctor is told the target',
  informBlockedPlayer: 'A blocked player is told',
  trackerIncludesActionType: 'A tracker learns what kind of action it was',
} as const;

export const CONFIG_LABEL: Record<string, string> = {
  informTarget: 'Tell that player',
  redirectToSelf: 'Redirect onto the protector',
  redirectsPoison: 'Also redirect poison',
  includesActionType: 'Include the kind of action',
  publicLeader: 'The leader is public',
  permanentSteal: 'The copy lasts the whole game',
  separateAttack: 'This is its own attack',
  weight: 'Vote weight',
  durationNights: 'Nights it lasts',
};

export function configLabel(key: string): string {
  return CONFIG_LABEL[key] ?? key;
}
