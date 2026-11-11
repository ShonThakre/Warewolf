import type { AbilityDefinition, Faction, RoleDefinition } from '@warewolf/domain';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useMemo, useState } from 'react';
import { roleArtUrl } from '../assets/art';
import { FACTION_CLASS, FACTION_LABEL } from '../game/components/lobbyCopy';
import { capabilityTitle } from '../game/components/roleCopy';
import '../game/components/scene-art.css';

type TeamFilter = 'all' | 'wolf' | 'village' | 'neutral' | 'special';

const FILTERS: { value: TeamFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'wolf', label: 'Wolf' },
  { value: 'village', label: 'Village' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'special', label: 'Special' },
];

function matchesTeam(role: RoleDefinition, filter: TeamFilter): boolean {
  if (filter === 'all') return true;
  const faction: Faction = role.defaultFaction;
  if (filter === 'wolf') return faction === 'WOLF_PACK';
  if (filter === 'village') return faction === 'VILLAGE';
  if (filter === 'neutral') return faction === 'NEUTRAL';
  return faction === 'INDEPENDENT';
}

function limitLine(ability: AbilityDefinition): string {
  const parts: string[] = [];
  if (ability.onlyRound != null) parts.push(`Only in round ${ability.onlyRound}.`);
  else if (ability.availableFromRound > 1) parts.push(`From round ${ability.availableFromRound}.`);
  if (ability.usesPerPhase === 1) parts.push('Once each phase.');
  else if (ability.usesPerPhase != null) parts.push(`${ability.usesPerPhase} times each phase.`);
  if (ability.usesPerGame != null) parts.push(`${ability.usesPerGame} times each game.`);
  if (ability.cooldownNights > 0) parts.push(`Rests ${ability.cooldownNights} ${ability.cooldownNights === 1 ? 'night' : 'nights'}.`);
  return parts.join(' ');
}

/** Public catalog. Cards are read-only. Unresolved roles stay visible and disabled. */
export function Roles() {
  const [filter, setFilter] = useState<TeamFilter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<RoleDefinition | null>(null);

  const roles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return DEFAULT_CATALOG.roles.filter((role) => {
      if (!matchesTeam(role, filter)) return false;
      if (!needle) return true;
      const profile = role.profiles[role.defaultProfileId];
      return role.displayName.toLowerCase().includes(needle) || (profile?.description ?? role.description).toLowerCase().includes(needle);
    });
  }, [filter, query]);

  const openProfile = open ? open.profiles[open.defaultProfileId] : null;

  return (
    <div className="ww-catalog">
      <h1 className="ww-victory-title">Role catalog</h1>
      <div className="ww-catalog-tools">
        <ToggleButtonGroup exclusive value={filter} onChange={(_event, value: TeamFilter | null) => value && setFilter(value)} aria-label="Teams">
          {FILTERS.map((item) => (
            <ToggleButton key={item.value} value={item.value}>
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} size="small" />
      </div>
      <div className="ww-catalog-grid">
        {roles.map((role) => {
          const locked = role.implementationStatus === 'UNRESOLVED' || !role.seatable;
          const team = FACTION_LABEL[role.defaultFaction];
          const profile = role.profiles[role.defaultProfileId];
          const portrait = roleArtUrl(role.id);
          return (
            <Button key={role.id} className="ww-catalog-card" variant="outlined" disabled={locked} onClick={() => setOpen(role)}>
              <span className={`ww-role-portrait ${FACTION_CLASS[role.defaultFaction]}`} aria-hidden="true">
                {portrait ? <img src={portrait} alt="" /> : team}
              </span>
              <span className="ww-catalog-name">{role.displayName}</span>
              <span className={FACTION_CLASS[role.defaultFaction]}>{team}</span>
              <span className="ww-catalog-power">{profile?.description ?? role.description}</span>
              {locked ? <span className="ww-catalog-power">Not available yet. {role.decisionIds.join(', ')}</span> : null}
            </Button>
          );
        })}
      </div>
      <Dialog open={open != null} onClose={() => setOpen(null)} fullWidth maxWidth="xs" aria-labelledby="role-detail-title">
        <DialogTitle id="role-detail-title">{open?.displayName}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          {open && openProfile ? (
            <>
              <p className={FACTION_CLASS[open.defaultFaction]}>Team: {FACTION_LABEL[open.defaultFaction]}</p>
              <p className="ww-catalog-power">{openProfile.description}</p>
              {openProfile.abilities.map((ability) => {
                const title = capabilityTitle(ability.capability);
                const limits = limitLine(ability);
                return (
                  <p key={ability.id} className="ww-catalog-power">
                    {limits ? `${title}. ${limits}` : title}
                  </p>
                );
              })}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
