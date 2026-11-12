import type { RoleDefinition } from '@warewolf/domain';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useMemo, useState } from 'react';
import { FACTION_LABEL } from '../game/components/lobbyCopy';
import { filterRoles, TEAM_FILTERS, teamCounts, type TeamFilter } from '../game/components/roleFilters';
import { RoleDetails, RoleTile } from '../game/components/RoleTile';
import '../game/components/scene-art.css';

/** Public catalog. Cards are read-only. Roles that cannot be seated stay visible and say why. */
export function Roles() {
  const [filter, setFilter] = useState<TeamFilter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<RoleDefinition | null>(null);

  const roles = useMemo(() => filterRoles(DEFAULT_CATALOG.roles, filter, query), [filter, query]);
  const counts = useMemo(() => teamCounts(DEFAULT_CATALOG.roles), []);

  return (
    <div className="ww-catalog">
      <header className="ww-catalog-head">
        <h1 className="ww-victory-title">Role catalog</h1>
        <p>Every role the game knows. Open a card for its abilities, limits, and how it wins. A room’s setup decides which roles are dealt.</p>
      </header>
      <div className="ww-catalog-tools">
        <ToggleButtonGroup exclusive value={filter} onChange={(_event, value: TeamFilter | null) => value && setFilter(value)} aria-label="Teams">
          {TEAM_FILTERS.map((item) => (
            <ToggleButton key={item.value} value={item.value}>
              {item.label} ({counts.get(item.value) ?? 0})
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} size="small" type="search" />
      </div>
      <p className="ww-catalog-count" aria-live="polite">
        {roles.length === 1 ? 'Showing 1 role' : `Showing ${roles.length} roles`}
      </p>
      {roles.length === 0 ? (
        <div className="ww-catalog-empty">
          <p>No role matches “{query.trim()}” in this team.</p>
          <Button
            variant="outlined"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            Clear search and filters
          </Button>
        </div>
      ) : (
        <ul className="ww-role-grid" aria-label="Roles">
          {roles.map((role) => (
            <li key={role.id}>
              <RoleTile role={role} teamName={FACTION_LABEL[role.defaultFaction]} onOpen={() => setOpen(role)} />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open != null} onClose={() => setOpen(null)} fullWidth maxWidth="xs" aria-labelledby="role-detail-title">
        <DialogTitle id="role-detail-title">{open?.displayName}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          {open ? <RoleDetails role={open} teamName={FACTION_LABEL[open.defaultFaction]} /> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
