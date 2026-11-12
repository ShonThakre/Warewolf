import { Button, Tab, Tabs } from '@mui/material';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LayoutInfo } from './layoutMode';
import { STAGE_SPECS, type StageMode } from './stageMode';
import { useLayoutMode } from './useLayoutMode';
import './game-layout.css';

/**
 * The one gameplay shell (docs/werewolf/ui-ux-plan.md, sections 3, 4, and 6).
 * Lobby, night, night results, day, voting, and results all render this; only
 * the slot content and the stage mode change. There is no mobile variant.
 *
 * Structure only. Each region is a named landmark with a stable class, and
 * the root carries the layout mode and stage as data attributes. The grid
 * templates, sizes, and colors are WEB-04's stylesheet.
 *
 * The top navigation is not a region here: `AppShell` renders it above every
 * route (marketing nav on desktop/tablet; session chrome on phone modes).
 */

export interface GameLayoutLabels {
  /** Status line: phase, round, timer or "Waiting for host". */
  readonly status: string;
  /** The stage: scene and foreground. */
  readonly stage: string;
  /** The discussion rail. "Room" in the lobby; a game screen may call it "Discussion". */
  readonly rail: string;
  /** The action row. */
  readonly action: string;
  /** Portrait switch label for a foreground that moves under the scene. */
  readonly players: string;
}

export const DEFAULT_LABELS: GameLayoutLabels = {
  status: 'Game status',
  stage: 'Village',
  rail: 'Room',
  action: 'Actions',
  players: 'Players',
};

export interface GameLayoutProps {
  /** Which stage the phase shows. Use `stageModeFor(phase)`. */
  readonly stage: StageMode;
  /** `GameStatusBar` content. */
  readonly status: ReactNode;
  /** `VillageScene`: the decorative plate behind the stage. */
  readonly scene?: ReactNode;
  /** What sits in front of the scene: avatars, `PlayerGrid`, a result card, or the victory banner. */
  readonly foreground?: ReactNode;
  /** `DiscussionPanel`. */
  readonly rail: ReactNode;
  /** `PlayerInteraction`: the current choice and the primary button. Always on screen. */
  readonly action: ReactNode;
  readonly labels?: Partial<GameLayoutLabels>;
  /** Replaces the measured viewport. For previews and tests; screens leave it out. */
  readonly layout?: LayoutInfo;
}

type Panel = 'players' | 'rail';

export function GameLayout({ stage, status, scene, foreground, rail, action, labels: labelOverrides, layout: forced }: GameLayoutProps) {
  const measured = useLayoutMode();
  const layout = forced ?? measured;
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };
  const spec = STAGE_SPECS[stage];

  const [railOpen, setRailOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(spec.portraitPanel ?? 'players');
  const [panelStage, setPanelStage] = useState(stage);
  // A new stage opens on its own default side of the switch (day: the chat; night and voting: the seats).
  if (panelStage !== stage) {
    setPanelStage(stage);
    setPanel(spec.portraitPanel ?? 'players');
  }
  const toggleRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const ids = { rail: `${id}-rail`, players: `${id}-players`, railTab: `${id}-rail-tab`, playersTab: `${id}-players-tab` };

  // Portrait with a seat grid: the grid moves under the scene and shares the middle with the rail.
  const switched = layout.stacked && spec.portraitForeground === 'middle' && foreground != null;
  const railHidden = (layout.railCollapsible && !railOpen) || (switched && panel !== 'rail');

  function closeRailOnEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !layout.railCollapsible || !railOpen) return;
    setRailOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <div
      className="ww-game-layout"
      data-layout={layout.mode}
      data-status-row={layout.statusRow}
      data-stage={stage}
      data-wash={spec.wash}
      data-foreground={spec.foreground}
      data-rail-open={layout.railCollapsible ? railOpen : undefined}
      data-panel={switched ? panel : undefined}
    >
      <section className="ww-game-status" aria-label={labels.status}>
        {status}
        {layout.railCollapsible ? (
          <Button
            ref={toggleRef}
            className="ww-game-rail-toggle"
            variant="outlined"
            aria-expanded={railOpen}
            aria-controls={ids.rail}
            onClick={() => setRailOpen((open) => !open)}
          >
            {labels.rail}
          </Button>
        ) : null}
      </section>

      <section className="ww-game-stage" aria-label={labels.stage}>
        <div className="ww-game-scene">{scene}</div>
        {!switched && foreground != null ? <div className="ww-game-foreground">{foreground}</div> : null}
      </section>

      {switched ? (
        <>
          <Tabs className="ww-game-switch" value={panel} onChange={(_event, value: Panel) => setPanel(value)} aria-label="Show">
            <Tab value="players" label={labels.players} id={ids.playersTab} aria-controls={ids.players} />
            <Tab value="rail" label={labels.rail} id={ids.railTab} aria-controls={ids.rail} />
          </Tabs>
          <section
            className="ww-game-players"
            id={ids.players}
            role="tabpanel"
            aria-labelledby={ids.playersTab}
            hidden={panel !== 'players'}
          >
            {foreground}
          </section>
        </>
      ) : null}

      <section
        className="ww-game-rail"
        id={ids.rail}
        hidden={railHidden}
        onKeyDown={closeRailOnEscape}
        {...(switched ? { role: 'tabpanel', 'aria-labelledby': ids.railTab } : { 'aria-label': labels.rail })}
      >
        {rail}
      </section>

      <section className="ww-game-action" aria-label={labels.action}>
        {action}
      </section>
    </div>
  );
}
