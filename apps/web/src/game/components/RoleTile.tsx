import type { RoleDefinition } from '@warewolf/domain';
import { ButtonBase } from '@mui/material';
import type { ReactNode } from 'react';
import { FACTION_CLASS } from './lobbyCopy';
import { RolePortrait } from './RolePortrait';
import { abilityTimingWord, capabilityTitle, catalogLimitLine, roleAvailability, victoryLine } from './roleCopy';
import './scene-art.css';

export interface RoleTileProps {
  role: RoleDefinition;
  /** Team word for this mode, such as "Chaos" for an Ultimate 20 Independent. */
  teamName: string;
  onOpen: () => void;
  /** Seats of this role in a setup draft. Leave out on the public catalog. */
  picked?: number;
  /** Setup controls under the card. */
  footer?: ReactNode;
}

/** One role card: portrait, name, team, and the short power. Same height as its neighbours. */
export function RoleTile({ role, teamName, onOpen, picked, footer }: RoleTileProps) {
  const availability = roleAvailability(role);
  const profile = role.profiles[role.defaultProfileId];
  const summary = profile?.description ?? role.description;
  const inSetup = picked != null && picked > 0;
  const badge = inSetup ? `${picked} in setup` : availability.badge;
  const label = [role.displayName, `${teamName} team`, badge].filter(Boolean).join('. ');

  return (
    <article className="ww-role-tile" data-available={availability.seatable} data-picked={inSetup}>
      {badge ? (
        <span className="ww-role-tile-badge" data-tone={inSetup ? 'picked' : undefined} aria-hidden="true">
          {inSetup ? `✓ ${badge}` : badge}
        </span>
      ) : null}
      <ButtonBase className="ww-role-tile-open" focusRipple onClick={onOpen} aria-label={`${label}. Show details`}>
        <RolePortrait roleId={role.id} name={role.displayName} faction={role.defaultFaction} />
        <span className="ww-role-tile-body">
          <span className="ww-role-tile-name">{role.displayName}</span>
          <span>
            <span className={`${FACTION_CLASS[role.defaultFaction]} ww-team-chip`}>{teamName}</span>
          </span>
          <span className="ww-role-tile-summary">{summary}</span>
        </span>
      </ButtonBase>
      {footer ? <div className="ww-role-tile-foot">{footer}</div> : null}
    </article>
  );
}

/** Dialog body for one role: team, power, each ability with its limits, availability, and how it wins. */
export function RoleDetails({ role, teamName, profileId, children }: { role: RoleDefinition; teamName: string; profileId?: string; children?: ReactNode }) {
  const profile = role.profiles[profileId ?? role.defaultProfileId] ?? role.profiles[role.defaultProfileId];
  const availability = roleAvailability(role);
  const abilities = profile?.abilities ?? [];
  return (
    <>
      <div className="ww-role-detail-head">
        <RolePortrait roleId={role.id} name={role.displayName} faction={role.defaultFaction} size="thumb" />
        <div>
          <span className={`${FACTION_CLASS[role.defaultFaction]} ww-team-chip`}>Team: {teamName}</span>
          {availability.badge ? <span className="ww-role-detail-muted">{availability.badge}</span> : null}
        </div>
      </div>
      <p className="ww-role-detail-section">{profile?.description ?? role.description}</p>
      {availability.explanation ? (
        <section className="ww-role-detail-section">
          <h3>Availability</h3>
          <p>{availability.explanation}</p>
        </section>
      ) : null}
      <section className="ww-role-detail-section">
        <h3>Abilities</h3>
        {abilities.length === 0 ? (
          <p className="ww-role-detail-muted">No special ability. Talks and votes during the day.</p>
        ) : (
          <ul>
            {abilities.map((ability) => {
              const limits = catalogLimitLine(ability);
              return (
                <li key={ability.id}>
                  <strong>
                    {capabilityTitle(ability.capability)} · {abilityTimingWord(ability.timing)}
                  </strong>
                  <br />
                  <span className="ww-role-detail-muted">{limits || 'No use limit.'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {profile ? (
        <section className="ww-role-detail-section">
          <h3>How this role wins</h3>
          <p>{victoryLine(profile.victory, teamName)}</p>
        </section>
      ) : null}
      {children}
    </>
  );
}
