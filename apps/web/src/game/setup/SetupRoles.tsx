import type { AbilityDefinition, Faction, GameConfiguration, RoleDefinition } from '@warewolf/domain';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Switch, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useMemo, useState } from 'react';
import { roleArtUrl } from '../../assets/art';
import { FACTION_CLASS, teamWord } from '../components/lobbyCopy';
import { capabilityTitle } from '../components/roleCopy';
import { configLabel, lockedModeCopy } from './setupCopy';
import { modeLocked, roleCount, setAbilityCharge, setAbilityConfig, setAbilityCooldown, setAbilityProfile, setRoleCount, setRoleFaction } from './setupDraft';

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
  if (filter === 'wolf') return role.defaultFaction === 'WOLF_PACK';
  if (filter === 'village') return role.defaultFaction === 'VILLAGE';
  if (filter === 'neutral') return role.defaultFaction === 'NEUTRAL';
  return role.defaultFaction === 'INDEPENDENT';
}

export function SetupRoles({
  draft,
  editable,
  onDraft,
}: {
  draft: GameConfiguration;
  editable: boolean;
  onDraft: (next: GameConfiguration) => void;
}) {
  const locked = modeLocked(draft);
  const lockedCopy = lockedModeCopy(draft.mode);
  const [filter, setFilter] = useState<TeamFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? DEFAULT_CATALOG.byId.get(openId) ?? null : null;

  const roles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return DEFAULT_CATALOG.roles.filter((role) => {
      if (!matchesTeam(role, filter)) return false;
      if (!needle) return true;
      return role.displayName.toLowerCase().includes(needle) || role.description.toLowerCase().includes(needle);
    });
  }, [filter, query]);

  return (
    <>
      {lockedCopy ? <p className="ww-setup-copy">{lockedCopy}</p> : null}
      <div className="ww-setup-tools">
        <ToggleButtonGroup exclusive value={filter} onChange={(_event, value: TeamFilter | null) => value && setFilter(value)} aria-label="Teams">
          {FILTERS.map((item) => (
            <ToggleButton key={item.value} value={item.value}>
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} size="small" />
      </div>
      <div className="ww-setup-grid">
        {roles.map((role) => {
          const count = roleCount(draft, role.id);
          const unavailable = role.implementationStatus === 'UNRESOLVED' || !role.seatable;
          const portrait = roleArtUrl(role.id);
          const team = teamWord(draft.mode, role.defaultFaction);
          return (
            <article key={role.id} className="ww-setup-role">
              <Button className="ww-setup-role-open" onClick={() => setOpenId(role.id)} disabled={unavailable && count === 0}>
                <span className={`ww-role-portrait ${FACTION_CLASS[role.defaultFaction]}`} aria-hidden="true">
                  {portrait ? <img src={portrait} alt="" /> : team}
                </span>
                <span className="ww-catalog-name">{role.displayName}</span>
                <span className={FACTION_CLASS[role.defaultFaction]}>{team}</span>
                <span className="ww-catalog-power">Seated {count}</span>
                {unavailable ? <span className="ww-catalog-power">Not available yet. {role.decisionIds.join(', ')}</span> : null}
              </Button>
              <div className="ww-setup-role-actions">
                <Button
                  aria-label={`Remove one ${role.displayName}`}
                  disabled={!editable || locked || unavailable || count === 0}
                  onClick={() => onDraft(setRoleCount(draft, role.id, count - 1))}
                >
                  Remove
                </Button>
                <Button
                  aria-label={`Add one ${role.displayName}`}
                  disabled={!editable || locked || unavailable || (role.uniqueInGame && count >= 1)}
                  onClick={() => onDraft(setRoleCount(draft, role.id, count + 1))}
                >
                  Add
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <Dialog open={open != null} onClose={() => setOpenId(null)} fullWidth maxWidth="xs" aria-labelledby="setup-role-title">
        {open ? (
          <RoleEditor role={open} draft={draft} editable={editable && !locked && roleCount(draft, open.id) > 0} onDraft={onDraft} onClose={() => setOpenId(null)} />
        ) : null}
      </Dialog>
    </>
  );
}

function RoleEditor({
  role,
  draft,
  editable,
  onDraft,
  onClose,
}: {
  role: RoleDefinition;
  draft: GameConfiguration;
  editable: boolean;
  onDraft: (next: GameConfiguration) => void;
  onClose: () => void;
}) {
  const entry = draft.roles.find((item) => item.roleId === role.id);
  const profileId = entry?.abilityProfile ?? role.defaultProfileId;
  const profile = role.profiles[profileId];
  const profiles = Object.values(role.profiles);
  const faction = entry?.faction ?? role.defaultFaction;

  return (
    <>
      <DialogTitle id="setup-role-title">{role.displayName}</DialogTitle>
      <DialogContent className="ww-setup-fields">
        <p className={FACTION_CLASS[role.defaultFaction]}>Team: {teamWord(draft.mode, faction)}</p>
        {profile ? <p className="ww-setup-copy">{profile.description}</p> : null}
        {editable && profiles.length > 1 ? (
          <TextField select label="Way to play this role" value={profileId} onChange={(event) => onDraft(setAbilityProfile(draft, role.id, event.target.value))}>
            {profiles.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.description}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        {editable && role.requiresFactionChoice ? (
          <TextField select label="Team for this role" value={faction} onChange={(event) => onDraft(setRoleFaction(draft, role.id, event.target.value as Faction))}>
            {role.allowedFactions.map((item) => (
              <MenuItem key={item} value={item}>
                {teamWord(draft.mode, item)}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        {profile?.abilities.map((ability) => (
          <AbilityEditor key={ability.id} ability={ability} draft={draft} roleId={role.id} editable={editable} chargePolicy={profile.chargePolicy} onDraft={onDraft} />
        ))}
        {!editable ? <p className="ww-setup-copy">Seat this role to edit its limits.</p> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </>
  );
}

function AbilityEditor({
  ability,
  draft,
  roleId,
  editable,
  chargePolicy,
  onDraft,
}: {
  ability: AbilityDefinition;
  draft: GameConfiguration;
  roleId: string;
  editable: boolean;
  chargePolicy: 'UNLIMITED' | 'LIMITED' | null;
  onDraft: (next: GameConfiguration) => void;
}) {
  const entry = draft.roles.find((item) => item.roleId === roleId);
  const override = entry?.overrides?.[ability.id];
  const usesPerGame = override?.usesPerGame === undefined ? ability.usesPerGame : override.usesPerGame;
  const cooldown = override?.cooldownNights ?? ability.cooldownNights;
  const title = ability.capability ? capabilityTitle(ability.capability) : ability.id;

  return (
    <fieldset className="ww-setup-fields">
      <legend className="ww-catalog-name">{title}</legend>
      {chargePolicy === 'UNLIMITED' ? <p className="ww-setup-copy">Uses each game: unlimited for this profile.</p> : null}
      {editable && chargePolicy !== 'UNLIMITED' ? (
        <>
          {chargePolicy !== 'LIMITED' ? (
            <label className="ww-setup-field">
              <Switch
                checked={usesPerGame === null}
                onChange={(_event, checked) => onDraft(setAbilityCharge(draft, roleId, ability.id, checked ? null : 1))}
              />
              Unlimited uses
            </label>
          ) : null}
          {usesPerGame !== null ? (
            <TextField
              className="ww-setup-number"
              label="Uses each game"
              type="number"
              value={usesPerGame}
              onChange={(event) => onDraft(setAbilityCharge(draft, roleId, ability.id, Number(event.target.value)))}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          ) : null}
          <TextField
            className="ww-setup-number"
            label="Nights of rest after a use"
            type="number"
            value={cooldown}
            onChange={(event) => onDraft(setAbilityCooldown(draft, roleId, ability.id, Number(event.target.value)))}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </>
      ) : null}
      {Object.entries(ability.config).map(([key, base]) => {
        const value = override?.config?.[key] ?? base;
        if (typeof base === 'boolean' && typeof value === 'boolean') {
          return (
            <label key={key} className="ww-setup-field">
              <Switch checked={value} disabled={!editable} onChange={(_event, checked) => onDraft(setAbilityConfig(draft, roleId, ability.id, key, checked))} />
              {configLabel(key)}
            </label>
          );
        }
        if (typeof base === 'number' && typeof value === 'number' && editable) {
          return (
            <TextField
              key={key}
              className="ww-setup-number"
              label={configLabel(key)}
              type="number"
              value={value}
              onChange={(event) => onDraft(setAbilityConfig(draft, roleId, ability.id, key, Number(event.target.value)))}
            />
          );
        }
        return null;
      })}
    </fieldset>
  );
}
