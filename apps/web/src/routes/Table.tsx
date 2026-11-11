import type { GameState, TargetRuleDto } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { SceneId } from '../assets/art';
import { GameStatusBar } from '../game/components/GameStatusBar';
import { NightActionPanel } from '../game/components/NightActionPanel';
import { PhaseCloseButton } from '../game/components/PhaseCloseButton';
import { PlayerAvatar } from '../game/components/PlayerAvatar';
import { PlayerGrid } from '../game/components/PlayerGrid';
import { VillageScene } from '../game/components/VillageScene';
import { useActionDraft } from '../game/components/actionDraft';
import { actionRowText, choiceNames, choiceReady, editablePrompt, matchesChoice, shownPrompt } from '../game/components/actionCopy';
import { choicePayload } from '../game/state/actions';
import { guestActionCopy, lifeLabel, phaseActionNote } from '../game/components/phaseCopy';
import { GameLayout, STAGE_SPECS, stageModeFor, type StageMode } from '../game/layout';
import { actionPrompts, useMyActions, useSubmitAction } from '../game/state/actions';
import { useSeat } from '../game/state/lobby';
import { useClosePhase, useGameState, useSecondsLeft } from '../game/state/phase';
import { useMyRole } from '../game/state/role';
import '../game/components/lobby-screen.css';
import '../game/components/table-screen.css';

/** Players at the table. A missing seat returns home. The reveal does not pull them back. */
export function Table() {
  const seat = useSeat();
  const { gameId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!seat) {
      navigate('/', { replace: true });
      return;
    }
    if (gameId && gameId !== seat.gameId) navigate(`/game/${seat.gameId}`, { replace: true });
  }, [seat, gameId, navigate]);

  if (!seat || gameId !== seat.gameId) return null;
  return <TableScreen />;
}

function TableScreen() {
  const view = useGameState();
  const seconds = useSecondsLeft(view);
  const control = useClosePhase(view.state);
  const roleView = useMyRole();
  const actionsView = useMyActions(view.state?.stateVersion);
  const submission = useSubmitAction();
  const prompts = actionPrompts(roleView.role, actionsView.actions);
  const draft = useActionDraft(prompts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [acked, setAcked] = useState<string | null>(null);
  const navigate = useNavigate();
  const { state, isLoading, error, refetch } = view;

  useEffect(() => {
    if (!state) return;
    if (state.status === 'LOBBY') navigate(`/lobby/${state.gameId}`, { replace: true });
    if (state.status === 'FINISHED') navigate(`/game/${state.gameId}/results`, { replace: true });
  }, [state, navigate]);

  if (isLoading && !state) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Table</h1>
        <p className="ww-status-copy">Opening the table…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Table</h1>
        <p className="ww-status-copy">{error?.message ?? 'The table could not be opened.'}</p>
        <Button variant="contained" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const stage = stageModeFor(state.phase);
  const note = phaseActionNote(control.error);
  const night = stage === 'night';
  const actionsReady = !roleView.isLoading && !actionsView.isLoading;
  const editable = prompts.filter(editablePrompt);
  const active = editable.find((prompt) => prompt.abilityInstanceId === activeId) ?? editable[0] ?? null;
  const selected = active ? (draft.selected[active.abilityInstanceId] ?? []) : [];
  const question = active ? (draft.questions[active.abilityInstanceId] ?? null) : null;
  const hint = active ? (draft.hints[active.abilityInstanceId] ?? '') : '';
  const ready = active ? choiceReady(active.ability.target, selected, question, hint) : false;
  const choiceSignature = active ? JSON.stringify([active.abilityInstanceId, active.ability.target.kind === 'PLAYERS' ? selected : [], question, hint]) : null;
  const stored = active ? matchesChoice(active, selected, question, hint) || acked === choiceSignature : false;
  const anyStored = prompts.some((prompt) => prompt.action?.status === 'PENDING' || prompt.action?.status === 'LOCKED');
  const line = actionsReady ? actionRowText(night, active, choiceNames(state.players, selected), stored, anyStored) : null;
  const privateSurface = night || (stage === 'day' && prompts.some(shownPrompt));
  const loadError = actionsView.error && actionsView.error.code !== 'NOT_FOUND' ? actionsView.error.message : null;
  const issue = submission.error?.issues[0]?.message ?? submission.error?.message ?? loadError;
  const target = active?.ability.target ?? null;
  const lockedFocus = prompts.find((prompt) => prompt.action?.status === 'LOCKED' && prompt.ability.target.kind === 'PLAYERS');
  const gridRule = target?.kind === 'PLAYERS' ? target : null;
  const gridSelected = active ? selected : (lockedFocus?.action?.targetPlayerIds ?? []);

  async function onSubmit() {
    if (!active || !ready || !choiceSignature) return;
    const rule = active.ability.target;
    const result = await submission.submit({
      abilityInstanceId: active.abilityInstanceId,
      targetPlayerIds: rule.kind === 'PLAYERS' ? [...selected] : [],
      payload: choicePayload(active, { hint, question }),
    });
    if (result) setAcked(choiceSignature);
  }

  return (
    <GameLayout
      stage={stage}
      labels={{ rail: 'Discussion' }}
      scene={<VillageScene scene={sceneFor(stage)} />}
      status={
        <GameStatusBar
          phase={state.phase}
          roundNumber={state.roundNumber}
          seconds={seconds}
          showClock={state.status === 'ACTIVE'}
          {...(state.status === 'ACTIVE' ? { onElapsed: refetch } : {})}
        />
      }
      foreground={
        <StageForeground
          state={state}
          stage={stage}
          privateSurface={privateSurface}
          panel={
            privateSurface ? (
              <NightActionPanel
                roleName={roleView.role?.currentRole.name ?? null}
                prompts={prompts}
                activeId={active?.abilityInstanceId ?? null}
                question={question}
                hint={hint}
                error={issue}
                onActivate={setActiveId}
                onQuestion={(next) => {
                  if (active) draft.chooseQuestion(active.abilityInstanceId, next);
                }}
                onHint={(next) => {
                  if (active) draft.setHint(active.abilityInstanceId, next);
                }}
              />
            ) : null
          }
          gridRule={gridRule}
          gridSelected={gridSelected}
          onToggle={(playerId) => {
            if (!active || active.ability.target.kind !== 'PLAYERS') return;
            draft.toggle(active.abilityInstanceId, playerId, active.ability.target.count);
          }}
        />
      }
      rail={<p className="ww-log-empty">No public events yet.</p>}
      action={
        <div className="ww-action">
          {note ? <p className="ww-action-copy">{note}</p> : null}
          {line ? (
            <p className="ww-action-copy" aria-live="polite">
              {line}
            </p>
          ) : null}
          {active ? (
            <Button variant="contained" color="secondary" disabled={!ready || submission.isSubmitting || stored} onClick={() => void onSubmit()}>
              Submit
            </Button>
          ) : null}
          {state.status === 'CANCELLED' ? (
            <Button component={Link} to="/" variant="contained" color="secondary">
              Play again
            </Button>
          ) : (
            <PhaseCloseButton control={control} />
          )}
          {!line && !control.canClose && state.status !== 'CANCELLED' ? <p className="ww-action-copy">{guestActionCopy(state)}</p> : null}
        </div>
      }
    />
  );
}

function sceneFor(stage: StageMode): SceneId {
  const scene = STAGE_SPECS[stage].scene;
  return scene === 'BY_OUTCOME' ? 'square_dusk' : scene;
}

/** Public seats. Night uses the shared target grid. The morning report's facts arrive later. */
function StageForeground({
  state,
  stage,
  privateSurface,
  panel,
  gridRule,
  gridSelected,
  onToggle,
}: {
  state: GameState;
  stage: StageMode;
  privateSurface: boolean;
  panel: ReactNode;
  gridRule: TargetRuleDto | null;
  gridSelected: readonly string[];
  onToggle: (playerId: string) => void;
}) {
  if (stage === 'night-results') {
    return (
      <article className="ww-morning" aria-label="Night results">
        <h2>The village wakes</h2>
        <p className="ww-status-copy">The public report appears here.</p>
      </article>
    );
  }

  if (stage === 'results') {
    return (
      <article className="ww-morning" aria-label="Result">
        <h2>This game was cancelled</h2>
        <p className="ww-status-copy">Roles stay hidden.</p>
      </article>
    );
  }

  if (stage === 'night') {
    return (
      <>
        {panel}
        <PlayerGrid players={state.players} youId={state.you.playerId} rule={gridRule} selected={gridSelected} onToggle={onToggle} />
      </>
    );
  }

  const grid = STAGE_SPECS[stage].foreground === 'player-grid';
  return (
    <>
      {privateSurface ? panel : null}
      <ul className="ww-seats" aria-label={grid ? 'Players' : 'Seated players'}>
        {state.players.map((player) => (
          <li key={player.playerId} className="ww-seat" data-life={player.lifeStatus}>
            <PlayerAvatar name={player.displayName} avatarId={player.avatarId} dead={player.lifeStatus === 'DEAD'} />
            <span className="ww-seat-name">{player.displayName}</span>
            <span className="ww-seat-life" data-life={player.lifeStatus}>
              {lifeLabel(player.lifeStatus)}
            </span>
            {player.isHost ? <span className="ww-seat-tag">Host</span> : null}
            {player.playerId === state.you.playerId ? <span className="ww-seat-tag">You</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
