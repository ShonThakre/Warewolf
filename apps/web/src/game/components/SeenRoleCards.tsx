import { DEFAULT_CATALOG, type Faction } from '@warewolf/domain';
import { RolePortrait } from './RolePortrait';
import { roleLabel, teamClass, teamWord } from './resultsCopy';
import type { SeenRole } from './tableNotes';

/**
 * The role cards a Seeker saw with the once-per-game ability (PLAY-FIX-01).
 * Private: only the Seeker's own report shows them. The portrait and the
 * team word come from the catalog; the team colour always comes with its word.
 */
export function SeenRoleCards({ cards }: { cards: readonly SeenRole[] }) {
  if (cards.length === 0) return null;
  return (
    <ul className="ww-seen-roles" aria-label="Role cards you have seen">
      {cards.map((card) => {
        const name = roleLabel(card.roleId);
        const faction: Faction = DEFAULT_CATALOG.byId.get(card.roleId)?.defaultFaction ?? 'VILLAGE';
        return (
          <li key={card.actionId} className="ww-seen-role">
            <RolePortrait roleId={card.roleId} name={name} faction={faction} size="thumb" loading="eager" />
            <span className="ww-seen-role-text">
              <span className="ww-seen-role-player">{card.displayName}</span>
              <span className="ww-seen-role-name">{name}</span>
              <span className={teamClass(faction)}>{teamWord(faction)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
