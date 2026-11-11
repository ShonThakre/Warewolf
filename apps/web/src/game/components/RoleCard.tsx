import type { MyRole } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { roleArtUrl, uiArtUrl } from '../../assets/art';
import { roleCardContent } from './roleCopy';
import { RoleBadge } from './RoleBadge';
import './scene-art.css';

export interface RoleCardProps {
  role: MyRole;
  /** When covered, the role name leaves the page. The role itself is not stored here. */
  covered: boolean;
  onCover: () => void;
  onShow: () => void;
}

/**
 * The private role card. Covering it shows "Your role" so the phone can be set down.
 * That is a glance guard, not a security boundary.
 */
export function RoleCard({ role, covered, onCover, onShow }: RoleCardProps) {
  if (covered) {
    const back = uiArtUrl('card_back');
    return (
      <div className="ww-role-card is-covered">
        {back ? <img className="ww-role-back" src={back} alt="" /> : null}
        <h1 className="ww-role-covered">Your role</h1>
        <Button onClick={onShow}>Show role</Button>
      </div>
    );
  }

  const content = roleCardContent(role);
  const portrait = roleArtUrl(role.currentRole.id);
  return (
    <article className="ww-role-card">
      <div className={`ww-role-portrait ${content.teamClass}`} aria-hidden="true">
        {portrait ? <img src={portrait} alt="" /> : content.team}
      </div>
      <div className="ww-role-heading">
        <RoleBadge name={content.name} />
        <p className={content.teamClass}>Team: {content.team}</p>
      </div>
      <Button onClick={onCover}>Hide role</Button>
      {content.description ? <p className="ww-role-copy">{content.description}</p> : null}
      {content.originalLine ? <p className="ww-role-copy">{content.originalLine}</p> : null}
      {content.abilities.length > 0 ? (
        <ul className="ww-role-abilities">
          {content.abilities.map((ability) => (
            <li key={ability.title + ability.detail}>
              <p className="ww-role-ability">{ability.title}</p>
              <p className="ww-role-copy">{ability.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="ww-role-tonight">{content.tonight}</p>
      {content.teammates ? <p className="ww-role-copy">{content.teammates}</p> : null}
    </article>
  );
}
