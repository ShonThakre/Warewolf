import type { Faction, RoleDefinition } from '@warewolf/domain';

export type TeamFilter = 'all' | Faction;

/** Filter chips for the catalog and the setup Roles step. The label matches the team word on each card. */
export const TEAM_FILTERS: readonly { value: TeamFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'WOLF_PACK', label: 'Wolf' },
  { value: 'VILLAGE', label: 'Village' },
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'INDEPENDENT', label: 'Independent' },
];

/** Team filter plus a search over the name and the short power. */
export function filterRoles(roles: readonly RoleDefinition[], filter: TeamFilter, query: string): RoleDefinition[] {
  const needle = query.trim().toLowerCase();
  return roles.filter((role) => {
    if (filter !== 'all' && role.defaultFaction !== filter) return false;
    if (!needle) return true;
    const profile = role.profiles[role.defaultProfileId];
    return role.displayName.toLowerCase().includes(needle) || (profile?.description ?? role.description).toLowerCase().includes(needle);
  });
}

export function teamCounts(roles: readonly RoleDefinition[]): ReadonlyMap<TeamFilter, number> {
  const counts = new Map<TeamFilter, number>([['all', roles.length]]);
  for (const role of roles) counts.set(role.defaultFaction, (counts.get(role.defaultFaction) ?? 0) + 1);
  return counts;
}
