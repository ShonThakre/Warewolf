import type { GameState, TargetRuleDto } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { SceneId } from '../assets/art';
import { DiscussionPanel } from '../game/components/DiscussionPanel';
import { GameStatusBar } from '../game/components/GameStatusBar';
import { KillTargetPanel } from '../game/components/KillTargetPanel';
import { NightActionPanel } from '../game/components/NightActionPanel';
import { PhaseCloseButton } from '../game/components/PhaseCloseButton';
import { PlayerAvatar } from '../game/components/PlayerAvatar';
import { PlayerGrid } from '../game/components/PlayerGrid';
import { VillageScene } from '../game/components/VillageScene';
import { useActionDraft } from '../game/components/actionDraft';
import { actionRowText, choiceNames, choiceReady, editablePrompt, matchesChoice, shownPrompt } from '../game/components/actionCopy';
import { choicePayload } from '../game/state/actions';
import { guestActionCopy, lifeLabel, phaseActionNote } from '../game/components/phaseCopy';
import { doctorAttackLine, killPickOf, killRowText, playerName, sameKillPick, type KillPick } from '../game/components/killCopy';
import { shownTally } from '../game/components/tallyCopy';
import { VoteTally } from '../game/components/VoteTally';
import { canCastBallot, voteMatches, voteRowText, VOTE_TARGET_RULE, type VoteChoice } from '../game/components/voteCopy';
import { GameLayout, STAGE_SPECS, stageModeFor, type StageMode } from '../game/layout';
import { actionPrompts, useMyActions, useSubmitAction } from '../game/state/actions';
import { checkChatDraft, useChat, useChatModeration, usePostChat } from '../game/state/chat';
import { useKillTarget, useSetKillTarget } from '../game/state/killTarget';
import { useDayTallies } from '../game/state/tallies';
import { useTableNotes } from '../game/state/tableNotes';
import { useSeat } from '../game/state/lobby';
import { useClosePhase, useGameState, useSecondsLeft } from '../game/state/phase';
import { useMyRole } from '../game/state/role';
import { useCastVote } from '../game/state/votes';
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
  const ballot = useCastVote();
  const chat = useChat(view.state?.phase, view.state?.stateVersion);
  const post = usePostChat();
  const moderation = useChatModeration();
  const kill = useKillTarget(view.state?.phase, view.state?.stateVersion);
  const tallies = useDayTallies(view.state?.phase, view.state?.stateVersion);
  const notes = useTableNotes(view.state?.phase, view.state?.stateVersion, view.state?.you.playerId, view.state?.players);
  const setKill = useSetKillTarget();
  const prompts = actionPrompts(roleView.role, actionsView.actions);
  const draft = useActionDraft(prompts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [acked, setAcked] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<VoteChoice | null>(null);
  const [storedVote, setStoredVote] = useState<string | null | undefined>(undefined);
  const [ballotKey, setBallotKey] = useState('');
  const [message, setMessage] = useState('');
  const [killPick, setKillPick] = useState<KillPick | null>(null);
  const [killAck, setKillAck] = useState<string | null>(null);
  const [killKey, setKillKey] = useState('');
  const navigate = useNavigate();
  const { state, isLoading, error, refetch } = view;

  useEffect(() => {
    if (!state) return;
    if (state.status === 'LOBBY') navigate(`/lobby/${state.gameId}`, { replace: true });
    if (state.status === 'FINISHED' || state.status === 'CANCELLED') navigate(`/game/${state.gameId}/results`, { replace: true });
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
  const voting = stage === 'voting';
  const voteKey = `${state.roundNumber}:${state.phase}`;
  if (voteKey !== ballotKey) {
    setBallotKey(voteKey);
    setVoteChoice(null);
    setStoredVote(undefined);
  }
  if (voteKey !== killKey) {
    setKillKey(voteKey);
    setKillPick(null);
    setKillAck(null);
  }
  const voteOpen = voting && canCastBallot(state.you, state.phase);
  const voteName = voteChoice?.kind === 'player' ? (state.players.find((player) => player.playerId === voteChoice.playerId)?.displayName ?? null) : null;
  const voteStored = voteMatches(voteChoice, storedVote);
  const voteLine = voting ? voteRowText({ phase: state.phase, canVote: voteOpen, choice: voteChoice, name: voteName, stored: voteStored }) : null;
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
  const attackLine = doctorAttackLine(prompts, state.players);
  const storedKill = kill.view ? killPickOf(kill.view.decision) : null;
  const showingKill = killPick ?? storedKill;
  const killName = showingKill?.kind === 'TARGET' ? playerName(state.players, showingKill.playerId) : null;
  const killSaved = showingKill != null && (sameKillPick(showingKill, storedKill) || killAck === (showingKill.kind === 'NO_KILL' ? 'NO_KILL' : showingKill.playerId));
  const killLine = kill.view ? killRowText({ editable: kill.view.editable, stored: killSaved ? showingKill : storedKill, pick: showingKill, name: killName }) : null;
  const killIssue = setKill.error?.issues[0]?.message ?? setKill.error?.message ?? kill.error?.message ?? null;
  const chatDraft = checkChatDraft(message);
  const showAbilityLine = !voting && line && !(kill.view?.editable && !active);

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

  async function onCast() {
    if (!voteChoice || voteStored) return;
    const targetPlayerId = voteChoice.kind === 'abstain' ? null : voteChoice.playerId;
    const result = await ballot.cast(targetPlayerId);
    if (result) setStoredVote(result.targetPlayerId);
  }

  async function onConfirmKill() {
    if (!kill.view?.editable || !showingKill || killSaved) return;
    const result = showingKill.kind === 'NO_KILL' ? await setKill.choose({ noKill: true }) : await setKill.choose({ targetPlayerId: showingKill.playerId });
    if (result) setKillAck(showingKill.kind === 'NO_KILL' ? 'NO_KILL' : showingKill.playerId);
  }

  async function onSend() {
    if (!chat.canPost || !chatDraft.sendable || post.isSending) return;
    const sent = await post.send(message);
    if (sent) setMessage('');
  }

  const tally = shownTally(state.phase, tallies.latest);
  const tallyCard = tally ? <VoteTally tally={tally} nameOf={(playerId) => playerName(state.players, playerId) ?? 'A player'} /> : null;
  const report = notes.length > 0 ? (
    <ul className="ww-report" aria-label="Your report">
      {notes.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  ) : null;

  return (
    <GameLayout
      stage={stage}
      labels={{ rail: 'Discussion' }}
      scene={<VillageScene scene={sceneFor(stage)} />}
      status={
        <>
          <GameStatusBar
            phase={state.phase}
            roundNumber={state.roundNumber}
            seconds={seconds}
            showClock={state.status === 'ACTIVE'}
            {...(state.status === 'ACTIVE' ? { onElapsed: refetch } : {})}
          />
          {state.you.isHost && state.status === 'ACTIVE' ? (
            <Button component={Link} to={`/game/${state.gameId}/host`} variant="text">
              Host
            </Button>
          ) : null}
        </>
      }
      foreground={
        <StageForeground
          state={state}
          stage={stage}
          tally={tallyCard}
          report={report}
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
                attackLine={attackLine}
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
          kill={kill.view ? <KillTargetPanel players={state.players} view={kill.view} pick={killPick} onPick={setKillPick} /> : null}
          gridRule={voting ? (voteOpen ? VOTE_TARGET_RULE : null) : gridRule}
          gridSelected={voting ? (voteChoice?.kind === 'player' ? [voteChoice.playerId] : []) : gridSelected}
          onToggle={(playerId) => {
            if (voting) {
              if (!voteOpen) return;
              setVoteChoice((current) => (current?.kind === 'player' && current.playerId === playerId ? null : { kind: 'player', playerId }));
              return;
            }
            if (!active || active.ability.target.kind !== 'PLAYERS') return;
            draft.toggle(active.abilityInstanceId, playerId, active.ability.target.count);
          }}
        />
      }
      rail={
        <DiscussionPanel
          players={state.players}
          youId={state.you.playerId}
          messages={chat.messages}
          mutedPlayerIds={chat.mutedPlayerIds}
          canPost={chat.canPost}
          refusal={chat.refusal}
          isLoading={chat.isLoading}
          loadError={chat.error?.message ?? null}
          draft={message}
          remaining={chatDraft.remaining}
          sendable={chatDraft.sendable}
          sending={post.isSending}
          sendError={post.error?.message ?? null}
          onDraft={setMessage}
          onSend={() => void onSend()}
          moderation={
            moderation.available
              ? {
                  isWorking: moderation.isWorking,
                  error: moderation.error?.message ?? null,
                  onDelete: (messageId) => void moderation.deleteMessage(messageId),
                  onMute: (playerId) => void moderation.mute(playerId),
                  onUnmute: (playerId) => void moderation.unmute(playerId),
                }
              : null
          }
        />
      }
      action={
        <div className="ww-action">
          {note ? <p className="ww-action-copy">{note}</p> : null}
          {ballot.error ? <p className="ww-action-copy">{ballot.error.message}</p> : null}
          {killIssue ? (
            <p className="ww-action-alert" role="alert">
              {killIssue}
            </p>
          ) : null}
          {voteLine ? (
            <p className="ww-action-copy" aria-live="polite">
              {voteLine}
            </p>
          ) : null}
          {killLine ? (
            <p className="ww-action-copy" aria-live="polite">
              {killLine}
            </p>
          ) : null}
          {showAbilityLine && line ? (
            <p className="ww-action-copy" aria-live="polite">
              {line}
            </p>
          ) : null}
          {voteOpen ? (
            <Button
              className="ww-abstain"
              variant="outlined"
              aria-pressed={voteChoice?.kind === 'abstain'}
              onClick={() => setVoteChoice((current) => (current?.kind === 'abstain' ? null : { kind: 'abstain' }))}
            >
              Abstain
            </Button>
          ) : null}
          {voteOpen ? (
            <Button variant="contained" color="secondary" disabled={!voteChoice || voteStored || ballot.isCasting} onClick={() => void onCast()}>
              Confirm vote
            </Button>
          ) : null}
          {kill.view?.editable ? (
            <Button className="ww-abstain" variant="outlined" aria-pressed={showingKill?.kind === 'NO_KILL'} onClick={() => setKillPick({ kind: 'NO_KILL' })}>
              No kill
            </Button>
          ) : null}
          {kill.view?.editable ? (
            <Button variant="contained" color="secondary" disabled={!showingKill || killSaved || setKill.isChoosing} onClick={() => void onConfirmKill()}>
              Confirm target
            </Button>
          ) : null}
          {!voting && active ? (
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
          {!voteLine && !killLine && !line && !control.canClose && state.status !== 'CANCELLED' ? <p className="ww-action-copy">{guestActionCopy(state)}</p> : null}
        </div>
      }
    />
  );
}

function sceneFor(stage: StageMode): SceneId {
  const scene = STAGE_SPECS[stage].scene;
  return scene === 'BY_OUTCOME' ? 'square_dusk' : scene;
}

/** Public seats. Night and voting use the shared target grid. The morning report's facts arrive later. */
function StageForeground({
  state,
  stage,
  tally,
  report,
  privateSurface,
  panel,
  kill,
  gridRule,
  gridSelected,
  onToggle,
}: {
  state: GameState;
  stage: StageMode;
  tally: ReactNode;
  report: ReactNode;
  privateSurface: boolean;
  panel: ReactNode;
  kill: ReactNode;
  gridRule: TargetRuleDto | null;
  gridSelected: readonly string[];
  onToggle: (playerId: string) => void;
}) {
  if (stage === 'night-results') {
    return (
      <article className="ww-morning" aria-label="Night results">
        <h2>The village wakes</h2>
        {tally}
        {report}
        {report ? null : <p className="ww-status-copy">The public report appears here.</p>}
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

  if (stage === 'night' || stage === 'voting') {
    return (
      <>
        {tally}
        {report}
        {panel}
        {kill}
        <PlayerGrid players={state.players} youId={state.you.playerId} rule={gridRule} selected={gridSelected} onToggle={onToggle} />
      </>
    );
  }

  const grid = STAGE_SPECS[stage].foreground === 'player-grid';
  return (
    <>
      {tally}
      {report}
      {privateSurface ? panel : null}
      {kill}
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
