import type { AbilityDefinition, Faction, GameConfiguration, RoleDefinition } from '@warewolf/domain';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Switch, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useMemo, useState } from 'react';
import { teamWord } from '../components/lobbyCopy';
import { capabilityTitle, roleAvailability } from '../components/roleCopy';
import { filterRoles, TEAM_FILTERS, type TeamFilter } from '../components/roleFilters';
import { RoleDetails, RoleTile } from '../components/RoleTile';
import { configLabel, lockedModeCopy } from './setupCopy';
import { modeLocked, roleCount, setAbilityCharge, setAbilityConfig, setAbilityCooldown, setAbilityProfile, setRoleCount, setRoleFaction } from './setupDraft';

/** Why the stepper cannot add, in words beside the control. Null when adding is allowed. */
function addBlocked(role: RoleDefinition, count: number, editable: boolean, locked: boolean): string | null {
  if (!editable) return 'Only the host edits.';
  if (locked) return 'Locked by this mode.';
  const availability = roleAvailability(role);
  if (!availability.seatable) return availability.badge;
  if (role.uniqueInGame && count >= 1) return 'One per game.';
  return null;
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
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? DEFAULT_CATALOG.byId.get(openId) ?? null : null;

  const roles = useMemo(() => {
    const found = filterRoles(DEFAULT_CATALOG.roles, filter, query);
    return onlyPicked ? found.filter((role) => roleCount(draft, role.id) > 0) : found;
  }, [filter, query, onlyPicked, draft]);

  return (
    <>
      {lockedCopy ? <p className="ww-setup-copy">{lockedCopy}</p> : null}
      {!lockedCopy && editable ? <p className="ww-setup-copy">Open a card to read the role and to change its limits.</p> : null}
      <div className="ww-setup-tools ww-catalog-tools">
        <ToggleButtonGroup exclusive value={filter} onChange={(_event, value: TeamFilter | null) => value && setFilter(value)} aria-label="Teams">
          {TEAM_FILTERS.map((item) => (
            <ToggleButton key={item.value} value={item.value}>
              {item.value === 'all' ? item.label : teamWord(draft.mode, item.value)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField label="Search roles" value={query} onChange={(event) => setQuery(event.target.value)} size="small" type="search" />
        <FormControlLabel control={<Switch checked={onlyPicked} onChange={(_event, checked) => setOnlyPicked(checked)} />} label="Only roles in this setup" />
      </div>
      {roles.length === 0 ? (
        <div className="ww-catalog-empty">
          <p>{onlyPicked ? 'No role in this setup matches.' : 'No role matches this search.'}</p>
          <Button
            variant="outlined"
            onClick={() => {
              setQuery('');
              setFilter('all');
              setOnlyPicked(false);
            }}
          >
            Show every role
          </Button>
        </div>
      ) : (
        <ul className="ww-role-grid" aria-label="Roles">
          {roles.map((role) => {
            const count = roleCount(draft, role.id);
            const team = teamWord(draft.mode, role.defaultFaction);
            const blocked = addBlocked(role, count, editable, locked);
            const canRemove = editable && !locked && count > 0;
            return (
              <li key={role.id}>
                <RoleTile
                  role={role}
                  teamName={team}
                  picked={count}
                  onOpen={() => setOpenId(role.id)}
                  footer={
                    editable ? (
                      <>
                        <span className="ww-stepper" role="group" aria-label={`${role.displayName} seats`}>
                          <IconButton aria-label={`Remove one ${role.displayName}`} disabled={!canRemove} onClick={() => onDraft(setRoleCount(draft, role.id, count - 1))}>
                            <StepGlyph kind="minus" />
                          </IconButton>
                          <span className="ww-stepper-count" aria-live="polite">
                            {count}
                          </span>
                          <IconButton aria-label={`Add one ${role.displayName}`} disabled={blocked != null} onClick={() => onDraft(setRoleCount(draft, role.id, count + 1))}>
                            <StepGlyph kind="plus" />
                          </IconButton>
                        </span>
                        {blocked ? <span className="ww-role-tile-note">{blocked}</span> : null}
                      </>
                    ) : (
                      <span className="ww-role-tile-note">{count > 0 ? `${count} ${count === 1 ? 'seat' : 'seats'}` : 'Not in this setup'}</span>
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
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
        <RoleDetails role={role} teamName={teamWord(draft.mode, faction)} profileId={profileId} />
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
        {!editable ? <p className="ww-setup-copy">The host can change these limits after adding this role to the setup.</p> : null}
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
  const title = capabilityTitle(ability.capability);

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

function StepGlyph({ kind }: { kind: 'plus' | 'minus' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      {kind === 'plus' ? <path d="M12 5v14" /> : null}
    </svg>
  );
}
