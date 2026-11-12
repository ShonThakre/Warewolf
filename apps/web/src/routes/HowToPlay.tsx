import { Button } from '@mui/material';
import { useMemo } from 'react';
import { Link } from 'react-router';
import type { Faction, GameMode } from '@warewolf/domain';
import { sceneArtUrl, type SceneId } from '../assets/art';
import { FACTION_CLASS, FACTION_LABEL } from '../game/components/lobbyCopy';
import { GOAL, HOST, ROUND, YOUR_ROLE, modeGuides, type ModeGuide, type Step } from '../game/howto/howToPlayCopy';
import '../game/components/scene-art.css';
import '../game/howto/how-to-play.css';

const MODE_SCENE: Record<GameMode, SceneId> = {
  INFECTION: 'square_night',
  CLASSIC: 'square_day',
  EXPANDED: 'square_dusk',
  CUSTOM: 'lobby_campfire',
  ULTIMATE_20: 'square_night',
};

/** HOWTO-01. The rules in plain words, then one card per mode. Read-only; anyone can open it. */
export function HowToPlay() {
  const guides = useMemo(() => modeGuides(), []);
  return (
    <div className="ww-catalog ww-howto">
      <header className="ww-catalog-head">
        <h1 className="ww-victory-title">How to play</h1>
        <p>Werewolf is a game of hidden roles. Most players are villagers; a few are wolves pretending to be villagers. Talk, watch, and vote to find them.</p>
      </header>

      <StepSection id="howto-goal" title="The goal" steps={GOAL} />
      <StepSection id="howto-round" title="One round" steps={ROUND} numbered />
      <StepSection id="howto-role" title="Your role card" steps={YOUR_ROLE} />
      <StepSection id="howto-host" title="The host" steps={HOST} />

      <section className="ww-howto-section" aria-labelledby="howto-modes">
        <h2 id="howto-modes" className="ww-howto-heading">
          Game modes
        </h2>
        <ul className="ww-howto-modes" aria-label="Game modes">
          {guides.map((guide) => {
            const art = sceneArtUrl(MODE_SCENE[guide.mode]);
            return (
              <li key={guide.mode}>
                <article className="ww-howto-card" aria-labelledby={`howto-mode-${guide.mode}`}>
                  {art ? (
                    <div className="ww-howto-card-art" aria-hidden="true">
                      <img src={art} alt="" />
                    </div>
                  ) : (
                    <div className="ww-howto-card-art" aria-hidden="true" />
                  )}
                  <div className="ww-howto-card-body">
                    <h3 id={`howto-mode-${guide.mode}`} className="ww-howto-card-title">
                      {guide.name}
                    </h3>
                    <p className="ww-howto-meta">
                      {guide.players} · {guide.pacing}
                    </p>
                    <p>{guide.summary}</p>
                    <ul className="ww-howto-points">
                      {guide.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    {guide.roles.length > 0 ? (
                      <div className="ww-howto-roles">
                        <h4 className="ww-howto-label">Starting roles</h4>
                        <ul aria-label={`${guide.name} starting roles`}>
                          {teamsOf(guide.roles).map(([faction, roles]) => (
                            <li key={faction}>
                              <span className={`${FACTION_CLASS[faction]} ww-team-chip`}>{FACTION_LABEL[faction]}</span>{' '}
                              {roles.map((role) => (role.count > 1 ? `${role.count} × ${role.name}` : role.name)).join(', ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {guide.packs.length > 0 ? (
                      <p className="ww-howto-meta">Ready-made setups: {guide.packs.join(', ')}.</p>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="ww-howto-actions">
        <Button component={Link} to="/roles" variant="outlined">
          See all roles
        </Button>
        <Button component={Link} to="/" variant="contained" color="secondary">
          Play
        </Button>
      </div>
    </div>
  );
}

/** Starting roles grouped under one team chip each, in the order the guide lists them. */
function teamsOf(roles: ModeGuide['roles']): [Faction, ModeGuide['roles'][number][]][] {
  const groups = new Map<Faction, ModeGuide['roles'][number][]>();
  for (const role of roles) groups.set(role.faction, [...(groups.get(role.faction) ?? []), role]);
  return [...groups.entries()];
}

function StepSection({ id, title, steps, numbered = false }: { id: string; title: string; steps: readonly Step[]; numbered?: boolean }) {
  const List = numbered ? 'ol' : 'ul';
  return (
    <section className="ww-howto-section" aria-labelledby={id}>
      <h2 id={id} className="ww-howto-heading">
        {title}
      </h2>
      <List className="ww-howto-steps">
        {steps.map((step) => (
          <li key={step.title} className="ww-howto-step">
            <strong>{step.title}.</strong> {step.text}
          </li>
        ))}
      </List>
    </section>
  );
}
