import type { MyRole } from '@warewolf/contracts';
import type { ReactNode } from 'react';
import { uiArtUrl } from '../../assets/art';
import { roleCardContent } from './roleCopy';
import { RoleBadge } from './RoleBadge';
import { RolePortrait } from './RolePortrait';
import './scene-art.css';

export interface RoleCardProps {
  role: MyRole;
  /** When covered, the role name and portrait leave the page. The role itself is not stored here. */
  covered: boolean;
  /** Hide, show, and continue. The card does not decide where continue goes. */
  children?: ReactNode;
}

function PeopleIcon() {
  return (
    <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2.6" />
      <circle cx="16" cy="9" r="2.1" />
      <path d="M3.8 18.2c.7-2.8 2.7-4.2 5.2-4.2s4.5 1.4 5.2 4.2" />
      <path d="M14.2 14.4c1.6.3 3 1.3 3.6 3.4" />
    </svg>
  );
}

function RowIcon({ kind }: { kind: 'ability' | 'night' | 'team' }) {
  if (kind === 'night') {
    return (
      <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.5 3.5a7.5 7.5 0 1 0 5 12.2A8.5 8.5 0 1 1 15.5 3.5z" />
      </svg>
    );
  }
  if (kind === 'team') {
    return (
      <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="9" r="2.4" />
        <circle cx="16" cy="9" r="2.4" />
        <path d="M3.5 18.5c.6-2.7 2.6-4 4.5-4s3.9 1.3 4.5 4" />
        <path d="M13 14.6c1.5.2 3.2 1.2 3.8 3.9" />
      </svg>
    );
  }
  return (
    <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

/**
 * The private role card. Covering it shows "Your role is hidden" so the phone can be set down.
 * That is a glance guard, not a security boundary.
 */
export function RoleCard({ role, covered, children }: RoleCardProps) {
  if (covered) {
    const back = uiArtUrl('card_back');
    return (
      <div className="ww-role-card is-covered">
        {back ? <img className="ww-role-back" src={back} alt="" /> : null}
        <h1 className="ww-role-covered">Your role is hidden</h1>
        <p className="ww-role-copy">Hidden from anyone looking at this screen. Show it again when nobody is watching.</p>
        {children}
      </div>
    );
  }

  const content = roleCardContent(role);
  return (
    <article className="ww-role-card" aria-labelledby="ww-role-name">
      <div className="ww-role-body">
        <RolePortrait roleId={role.currentRole.id} name={content.name} faction={role.currentRole.faction} size="card" loading="eager" />
        <div className="ww-role-main">
          <RoleBadge name={content.name} id="ww-role-name" />
          <span className={`${content.teamClass} ww-team-chip`}>
            <PeopleIcon />
            {content.team}
          </span>
          {content.description ? <p className="ww-role-copy">{content.description}</p> : null}
          {content.originalLine ? <p className="ww-role-copy">{content.originalLine}</p> : null}
          <hr className="ww-role-rule" />
          {content.abilities.length > 0 ? (
            <ul className="ww-role-abilities" aria-label="Your abilities">
              {content.abilities.map((ability) => (
                <li key={ability.title + ability.detail}>
                  <RowIcon kind="ability" />
                  <p className="ww-role-copy">
                    <span className="ww-role-ability">{ability.title}.</span> {ability.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ww-role-fact">
            <RowIcon kind="night" />
            <p className="ww-role-tonight">{content.tonight}</p>
          </div>
          {content.teammates ? (
            <div className="ww-role-fact ww-role-team" aria-label="Your team">
              <RowIcon kind="team" />
              <div>
                <p className="ww-role-copy">{content.teammates}</p>
                <p className="ww-role-note">Keep this to yourself. The public log never shows it.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </article>
  );
}
