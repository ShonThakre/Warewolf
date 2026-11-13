import { DEFAULT_CATALOG, DEFAULT_PACK_BY_MODE, GAME_MODES, MODE_BOUNDS, ROLE_PACKS, getPack, type Faction, type GameMode } from '@warewolf/domain';
import { MODE_LABEL } from '../components/lobbyCopy';

/**
 * HOWTO-01: the How to Play page, in plain words. The rules text is written
 * here; every number (seats, timers, starting roles) is read from the domain
 * packs, so the page cannot drift from what the server deals.
 * docs/werewolf/how-to-play.md carries the same text for reading outside the app.
 */

export interface Step {
  readonly title: string;
  readonly text: string;
}

export const GOAL: readonly Step[] = [
  { title: 'Village', text: 'Find the wolves and vote every one of them out.' },
  { title: 'Wolves', text: 'Stay hidden and remove villagers until there are as many wolves as everyone else.' },
  { title: 'Solo roles', text: 'A few roles, such as the Jester, have a goal of their own. Their card says how they win.' },
];

export const ROUND: readonly Step[] = [
  { title: 'Night', text: 'Everyone’s eyes are closed. Roles with a power pick a player in secret. Wolves choose who to attack.' },
  { title: 'Morning', text: 'The game shows who was eliminated in the night, if anyone. Private results go only to the player who earned them.' },
  { title: 'Day', text: 'Living players talk in the discussion. Share what you know, or bluff.' },
  { title: 'Vote', text: 'Each living player votes for someone, or abstains. The most votes is eliminated. A tie gets one revote between the tied players; a second tie eliminates nobody.' },
];

export const HOST: readonly Step[] = [
  { title: 'Sets up the room', text: 'Creates the game, picks the mode, and shares the room code. The game starts once every seat is filled.' },
  { title: 'Moves the game on', text: 'Closes each phase with the button at the bottom of the screen, unless the mode runs on timers.' },
  { title: 'Sees everything', text: 'The host dashboard shows every role and every night choice. The host also plays a seat, so play fair.' },
];

export const YOUR_ROLE: readonly Step[] = [
  { title: 'Read it alone', text: 'Your role card shows your team, your power, and how you win. Nobody else can see it. Use Hide role when someone is looking.' },
  { title: 'Use your power', text: 'At night, choose a player and press Submit. You can change your choice until the host closes the night.' },
  { title: 'If you are eliminated', text: 'You can still read the discussion, but you cannot talk, vote, or act.' },
];

export interface ModeGuide {
  readonly mode: GameMode;
  readonly name: string;
  /** "20 players" or "6 to 20 players". */
  readonly players: string;
  /** Who moves the game on, with the timer lengths when timed. */
  readonly pacing: string;
  readonly summary: string;
  readonly points: readonly string[];
  /** The starting roles of the mode's default setup, largest team first. Empty for Custom. */
  readonly roles: readonly { readonly name: string; readonly count: number; readonly faction: Faction }[];
  /** Other ready-made setups for this mode. */
  readonly packs: readonly string[];
}

const MODE_TEXT: Readonly<Record<GameMode, { summary: string; points: readonly string[] }>> = {
  INFECTION: {
    summary: 'The main game. One hidden Alpha Wolf grows the pack by turning villagers into wolves.',
    points: [
      'Each night the Alpha Wolf can infect one player. That player becomes a wolf, quietly. It can happen up to 4 times.',
      'Wolves do not know who the other wolves are.',
      'The host picks the night’s attack from the names the wolves chose. The Doctor is told who will be attacked and can save them.',
      'Seekers check one player a night: wolf or not. Once per game, a Seeker may see one player\'s role card instead. The Guard protects one player. The Witch has one save and one poison for the whole game.',
    ],
  },
  CLASSIC: {
    summary: 'The best first game. A small pack of wolves who know each other, against a village with a Seeker and a Doctor.',
    points: ['No infection: the pack never grows.', 'Wolves see their teammates and agree on one attack.', 'Timers move each phase on, so nobody has to.'],
  },
  EXPANDED: {
    summary: 'The same game with many more roles to discover.',
    points: [
      'Ready-made setups focus on information, protection, or chaos, or seat 24 or 30 players.',
      'Solo roles join: the Jester wins by being voted out, the Assassin by having their mark die, the Lone Wolf by being the last one standing.',
      'When a solo player wins, the game can keep going for everyone else.',
    ],
  },
  ULTIMATE_20: {
    summary: 'Twenty seats, fifteen special roles, and several goals running at once.',
    points: [
      'The Alpha Wolf can kill or infect each night. The Shadow Wolf cancels someone’s power.',
      'The Vampire marks players, who join the Vampire team in secret at dawn.',
      'Watch for the Joker, the Fox, the Necromancer, and the Chaos Demon: each wins their own way.',
      'A Ghost who is eliminated can leave the room one hint.',
    ],
  },
  CUSTOM: {
    summary: 'The host picks every role and every rule.',
    points: [
      'Choose any roles the catalog allows, for 6 to 30 players.',
      'The setup is checked before the game starts. It needs at least one wolf.',
      'Start from Classic and change one thing at a time.',
    ],
  },
};

function playersLine(mode: GameMode): string {
  const { min, max } = MODE_BOUNDS[mode];
  return min === max ? `${min} players` : `${min} to ${max} players`;
}

function pacingLine(mode: GameMode): string {
  const config = getPack(DEFAULT_PACK_BY_MODE[mode])?.config;
  if (config?.pacing === 'TIMED' && config.timers) {
    const { nightSeconds, daySeconds, voteSeconds } = config.timers;
    return `Timers move the game on: ${nightSeconds} seconds of night, ${daySeconds} of discussion, and ${voteSeconds} to vote. The host can still move on early.`;
  }
  return mode === 'CUSTOM' ? 'The host chooses: host-paced or timers.' : 'The host moves each phase on when the table is ready.';
}

const FACTION_ORDER: readonly Faction[] = ['VILLAGE', 'WOLF_PACK', 'NEUTRAL', 'INDEPENDENT'];

function startingRoles(mode: GameMode): ModeGuide['roles'] {
  const config = getPack(DEFAULT_PACK_BY_MODE[mode])?.config;
  if (!config) return [];
  return config.roles
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const role = DEFAULT_CATALOG.byId.get(entry.roleId);
      return { name: role?.displayName ?? entry.roleId, count: entry.count, faction: entry.faction ?? role?.defaultFaction ?? 'VILLAGE' };
    })
    .sort((a, b) => FACTION_ORDER.indexOf(a.faction) - FACTION_ORDER.indexOf(b.faction) || b.count - a.count);
}

function otherPacks(mode: GameMode): string[] {
  if (mode !== 'EXPANDED') return [];
  return ROLE_PACKS.filter((pack) => pack.config.mode === mode && pack.status !== 'TEMPLATE').map((pack) => pack.name);
}

/** One guide per mode, in the order the setup screen lists them. */
export function modeGuides(): ModeGuide[] {
  return GAME_MODES.map((mode) => ({
    mode,
    name: MODE_LABEL[mode],
    players: playersLine(mode),
    pacing: pacingLine(mode),
    summary: MODE_TEXT[mode].summary,
    points: MODE_TEXT[mode].points,
    roles: startingRoles(mode),
    packs: otherPacks(mode),
  }));
}
