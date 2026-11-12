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
import { actionRowText, actionStatus, choiceNames, choiceReady, choiceSeatLine, editablePrompt, matchesChoice, promptLabel, shownPrompt, submitLabel, type ActionTone } from '../game/components/actionCopy';
import { choicePayload } from '../game/state/actions';
import { dayDiscussionActionCopy, guestActionCopy, lifeLabel, phaseActionNote } from '../game/components/phaseCopy';
import { doctorAttackLine, killPickOf, killRowText, playerName, sameKillPick, type KillPick } from '../game/components/killCopy';
import { morningHeadline, morningSurvivors } from '../game/components/morningCopy';
import { shownTally } from '../game/components/tallyCopy';
import { VoteTally } from '../game/components/VoteTally';
import {
  canCastBallot,
  canChangeVote,
  revoteBoardCopy,
  revoteTargets,
  showAbstain,
  voteButtonLabel,
  voteLifeLabel,
  voteMatches,
  votePrivacyCopy,
  voteRowText,
  voteSeatLabel,
  VOTE_TARGET_RULE,
  type VoteChoice,
  type VoteRules,
} from '../game/components/voteCopy';
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
  const draft = useActionDraft(prompts, view.state ? `${view.state.roundNumber}:${view.state.phase}` : '');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [acked, setAcked] = useState<string | null>(null);
  const [voteChoice, setVoteChoice] = useState<VoteChoice | null>(null);
  const [storedVote, setStoredVote] = useState<string | null | undefined>(undefined);
  const [ballotKey, setBallotKey] = useState('');
  const [message, setMessage] = useState('');
  const [killPick, setKillPick] = useState<KillPick | null>(null);
  const [killAck, setKillAck] = useState<string | null>(null);
  const [killKey, setKillKey] = useState('');
  const [roleCovered, setRoleCovered] = useState(false);
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
  const isRevote = state.phase === 'REVOTE';
  const voteKey = `${state.roundNumber}:${state.phase}`;
  if (voteKey !== ballotKey) {
    setBallotKey(voteKey);
    setVoteChoice(null);
    setStoredVote(undefined);
  }
  if (voteKey !== killKey) {
    setKillKey(voteKey);
    setAcked(null);
    setKillPick(null);
    setKillAck(null);
  }
  const voteOpen = voting && canCastBallot(state.you, state.phase);
  const voteNominee = voteChoice?.kind === 'player' ? (state.players.find((player) => player.playerId === voteChoice.playerId) ?? null) : null;
  const voteName = voteNominee?.displayName ?? null;
  const voteStored = voteMatches(voteChoice, storedVote);
  const voteRules: VoteRules = { canAbstain: state.voting.abstain, canChange: state.voting.changeUntilClose };
  const voteLine = voting ? voteRowText({ phase: state.phase, canVote: voteOpen, choice: voteChoice, name: voteName, stored: voteStored, rules: voteRules }) : null;
  const abstainVisible = voteOpen && showAbstain(voteRules);
  const voteChangeable = canChangeVote(voteRules, storedVote !== undefined);
  const note = phaseActionNote(control.error);
  const night = stage === 'night';
  const morning = stage === 'night-results';
  const dayTalk = stage === 'day';
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
  // Day discussion stays public. Only an open (or already submitted) day ability keeps a private panel.
  const privateSurface =
    night ||
    (stage === 'day' &&
      prompts.some((prompt) => editablePrompt(prompt) || (prompt.action != null && prompt.availability !== 'NOT_THIS_PHASE' && shownPrompt(prompt))));
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
  const revoteIds = revoteTargets(state.phase, state.roundNumber, tallies.tallies);
  const conflict = phaseActionNote(ballot.error);
  const problems = [note, conflict, killIssue].filter((text, index, all): text is string => Boolean(text) && all.indexOf(text) === index);
  const status = voting
    ? voteOpen
      ? actionStatus({ active: true, ready: voteChoice != null, stored: voteStored, anyStored: false })
      : null
    : kill.view?.editable && !active
      ? actionStatus({ active: true, ready: showingKill != null, stored: killSaved, anyStored: false })
      : actionsReady && (night || active)
        ? actionStatus({ active: active != null, ready, stored, anyStored })
        : null;

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

  const nightPrompt = active ? promptLabel(active.ability) : null;
  const nightTarget = night && active?.ability.target.kind === 'PLAYERS' ? choiceSeatLine(state.players, selected) : '';

  function roleControls(part: 'all' | 'identity' | 'controls') {
    return (
      <NightActionPanel
        part={part}
        covered={roleCovered}
        onToggleCover={setRoleCovered}
        roleName={roleView.role?.currentRole.name ?? null}
        roleId={roleView.role?.currentRole.id ?? null}
        faction={roleView.role?.currentRole.faction ?? null}
        prompts={prompts}
        activeId={active?.abilityInstanceId ?? null}
        question={question}
        hint={hint}
        error={issue}
        attackLine={attackLine}
        identityLine={part === 'identity' ? nightPrompt : null}
        onActivate={setActiveId}
        onQuestion={(next) => {
          if (active) draft.chooseQuestion(active.abilityInstanceId, next);
        }}
        onHint={(next) => {
          if (active) draft.setHint(active.abilityInstanceId, next);
        }}
      />
    );
  }
  const tally = shownTally(state.phase, tallies.latest);
  const tallyCard = tally ? <VoteTally tally={tally} nameOf={(playerId) => playerName(state.players, playerId) ?? 'A player'} /> : null;
  const report = notes.length > 0 ? (
    <ul className="ww-report" aria-label="Your report">
      {notes.map((line) => (
        <li key={line} data-note={noteTone(line)}>
          {line}
        </li>
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
              Host controls
            </Button>
          ) : null}
          <Button component={Link} to="/how-to-play" variant="text" className="ww-howto-inline">
            How to play
          </Button>
        </>
      }
      foreground={
        <StageForeground
          state={state}
          stage={stage}
          isRevote={isRevote}
          tally={tallyCard}
          notes={notes}
          report={morning ? null : report}
          privateSurface={privateSurface}
          panel={privateSurface ? roleControls(night ? 'controls' : 'all') : null}
          kill={kill.view ? <KillTargetPanel players={state.players} view={kill.view} pick={killPick} onPick={setKillPick} /> : null}
          gridRule={voting ? (voteOpen && voteChangeable ? VOTE_TARGET_RULE : null) : gridRule}
          gridSelected={voting ? (voteChoice?.kind === 'player' ? [voteChoice.playerId] : []) : gridSelected}
          allowedIds={voting ? revoteIds : null}
          onToggle={(playerId) => {
            if (voting) {
              if (!voteOpen || !voteChangeable) return;
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
          phase={state.phase}
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
        <div
          className={
            night
              ? 'ww-action is-night'
              : morning
                ? 'ww-action is-morning'
                : dayTalk
                  ? 'ww-action is-day'
                  : voting
                    ? `ww-action is-voting${isRevote ? ' is-revote' : ''}`
                    : 'ww-action'
          }
        >
          {night ? roleControls('identity') : null}
          {problems.length > 0 ? (
            <div className="ww-action-alert-row">
              {problems.map((problem) => (
                <p key={problem} className="ww-action-alert" role="alert">
                  {problem}
                </p>
              ))}
              <Button variant="outlined" onClick={() => void refetch()}>
                Refresh
              </Button>
            </div>
          ) : null}
          {night && active?.ability.target.kind === 'PLAYERS' ? (
            <div className="ww-night-pick">
              <span className="ww-night-pick-label">Selected target</span>
              <p className="ww-night-pick-value" aria-live="polite">
                {nightTarget || '—'}
              </p>
            </div>
          ) : null}
          {voting ? (
            <div className="ww-vote-nominee" aria-live="polite">
              <span className="ww-vote-nominee-label">Selected nominee</span>
              {voteNominee ? (
                isRevote ? (
                  <p className="ww-vote-nominee-name">{voteSeatLabel(voteNominee.seatNumber, voteNominee.displayName, 'dash')}</p>
                ) : (
                  <div className="ww-vote-nominee-card">
                    <PlayerAvatar name={voteNominee.displayName} avatarId={voteNominee.avatarId} />
                    <div className="ww-vote-nominee-copy">
                      <span className="ww-vote-nominee-name">{voteSeatLabel(voteNominee.seatNumber, voteNominee.displayName)}</span>
                      <span className="ww-seat-life" data-life={voteNominee.lifeStatus}>
                        <span className="ww-seat-life-dot" aria-hidden="true" />
                        {voteLifeLabel(voteNominee.lifeStatus)}
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <p className="ww-vote-nominee-empty">{voteChoice?.kind === 'abstain' ? 'Abstain' : '—'}</p>
              )}
              {isRevote && voteOpen ? (
                <p className="ww-vote-privacy">
                  <span className="ww-vote-privacy-lock" aria-hidden="true" />
                  {votePrivacyCopy('REVOTE')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="ww-action-head">
            {dayTalk ? (
              <div className="ww-day-guide">
                <span className="ww-day-guide-mark" aria-hidden="true">
                  i
                </span>
                <div className="ww-day-guide-copy">
                  <p className="ww-day-guide-title">{dayDiscussionActionCopy().title}</p>
                  <p className="ww-day-guide-body">{control.canClose ? dayDiscussionActionCopy().body : guestActionCopy(state)}</p>
                </div>
              </div>
            ) : null}
            {status && !voting ? (
              <span className="ww-pill" data-tone={PILL_TONE[status.tone]}>
                {status.label}
              </span>
            ) : null}
            {voteLine ? (
              <p className={voting ? 'ww-sr' : 'ww-action-copy'} aria-live="polite">
                {voteLine}
              </p>
            ) : null}
            {abstainVisible && !voteChoice ? <p className={voting ? 'ww-sr' : 'ww-action-copy'}>Abstain sends a ballot that names nobody.</p> : null}
            {killLine ? (
              <p className="ww-action-copy" aria-live="polite">
                {killLine}
              </p>
            ) : null}
            {showAbilityLine && line && !night ? (
              <p className="ww-action-copy" aria-live="polite">
                {line}
              </p>
            ) : null}
            {showAbilityLine && line && night && line !== nightPrompt ? (
              <p className="ww-sr" aria-live="polite">
                {line}
              </p>
            ) : null}
            {!dayTalk && !voting && !voteLine && !killLine && !line && !control.canClose && state.status !== 'CANCELLED' ? <p className="ww-action-copy">{guestActionCopy(state)}</p> : null}
            {!morning && !dayTalk && !voting && !voteLine && !killLine && !line && control.canClose ? <p className="ww-action-copy">You close this phase when the table is ready.</p> : null}
          </div>
          <div className="ww-action-buttons">
            {abstainVisible ? (
              <Button
                className="ww-abstain"
                variant="outlined"
                aria-pressed={voteChoice?.kind === 'abstain'}
                disabled={!voteChangeable}
                onClick={() => setVoteChoice((current) => (current?.kind === 'abstain' ? null : { kind: 'abstain' }))}
              >
                {voteChoice?.kind === 'abstain' ? '✓ Abstain' : 'Abstain'}
              </Button>
            ) : null}
            {voteOpen ? (
              <div className="ww-vote-submit">
                <Button
                  className="ww-vote-submit-btn"
                  variant="contained"
                  color="secondary"
                  disabled={!voteChoice || voteStored || ballot.isCasting || (storedVote !== undefined && !voteChangeable && !voteStored)}
                  onClick={() => void onCast()}
                >
                  {voteButtonLabel({
                    hasStored: storedVote !== undefined,
                    stored: voteStored,
                    casting: ballot.isCasting,
                    canChange: voteRules.canChange,
                    phase: state.phase,
                  })}
                </Button>
                {isRevote ? null : (
                  <p className="ww-vote-privacy">
                    <span className="ww-vote-privacy-lock" aria-hidden="true" />
                    {votePrivacyCopy()}
                  </p>
                )}
              </div>
            ) : null}
            {kill.view?.editable ? (
              <Button className="ww-abstain" variant="outlined" aria-pressed={showingKill?.kind === 'NO_KILL'} onClick={() => setKillPick({ kind: 'NO_KILL' })}>
                {showingKill?.kind === 'NO_KILL' ? '✓ No kill' : 'No kill'}
              </Button>
            ) : null}
            {kill.view?.editable ? (
              <Button variant="contained" color="secondary" disabled={!showingKill || killSaved || setKill.isChoosing} onClick={() => void onConfirmKill()}>
                {setKill.isChoosing ? 'Sending…' : killSaved ? 'Target set' : 'Confirm target'}
              </Button>
            ) : null}
            {!voting && active ? (
              <Button className={night ? 'ww-night-submit' : undefined} variant="contained" color="secondary" disabled={!ready || submission.isSubmitting || stored} onClick={() => void onSubmit()}>
                {submitLabel({ hasStored: active.action != null, stored, submitting: submission.isSubmitting })}
              </Button>
            ) : null}
          </div>
          {control.canClose ? (
            <div
              className={morning || dayTalk ? 'ww-morning-controls' : 'ww-host-controls'}
              role="group"
              aria-label={morning || dayTalk ? 'Continue' : 'Host controls'}
            >
              {morning || dayTalk ? null : <span className="ww-host-label">Host</span>}
              <PhaseCloseButton control={control} tone="primary" />
            </div>
          ) : null}
        </div>
      }
    />
  );
}

const PILL_TONE: Record<ActionTone, string | undefined> = { choose: undefined, pending: 'waiting', done: 'ready', waiting: undefined };

function sceneFor(stage: StageMode): SceneId {
  const scene = STAGE_SPECS[stage].scene;
  return scene === 'BY_OUTCOME' ? 'square_dusk' : scene;
}

/** Public seats. Night and voting use the shared target grid. Morning shows the public night outcome. */
function StageForeground({
  state,
  stage,
  isRevote,
  tally,
  notes,
  report,
  privateSurface,
  panel,
  kill,
  gridRule,
  gridSelected,
  allowedIds,
  onToggle,
}: {
  state: GameState;
  stage: StageMode;
  isRevote: boolean;
  tally: ReactNode;
  notes: readonly string[];
  report: ReactNode;
  privateSurface: boolean;
  panel: ReactNode;
  kill: ReactNode;
  gridRule: TargetRuleDto | null;
  gridSelected: readonly string[];
  allowedIds: ReadonlySet<string> | null;
  onToggle: (playerId: string) => void;
}) {
  if (stage === 'night-results') {
    const survivors = morningSurvivors(state.players);
    const outcome = morningHeadline(notes);
    const privateNotes = notes.filter((line) => !/\bwas eliminated\b/i.test(line));
    return (
      <article className="ww-morning" aria-label="Night results">
        <div className="ww-morning-card">
          <p className="ww-morning-heading">
            <span className="ww-status-sun" aria-hidden="true" />
            Morning
          </p>
          <p className="ww-morning-outcome">{outcome}</p>
          {tally}
          <div className="ww-morning-survivors">
            <h3 className="ww-morning-survivors-label">Survivors</h3>
            <ul className="ww-morning-survivor-list" aria-label="Survivors">
              {survivors.map((player) => (
                <li key={player.playerId} className="ww-morning-survivor">
                  <PlayerAvatar name={player.displayName} avatarId={player.avatarId} />
                  <span className="ww-morning-survivor-name">{player.displayName}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {privateNotes.length > 0 ? (
          <ul className="ww-report" aria-label="Your report">
            {privateNotes.map((line) => (
              <li key={line} data-note={noteTone(line)}>
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  }

  // Night, voting, and day discussion with a PLAYERS ability share the target grid.
  // Plain day discussion keeps the static seat cards (UX-10).
  const dayPicking = stage === 'day' && gridRule?.kind === 'PLAYERS';
  if (stage === 'night' || stage === 'voting' || dayPicking) {
    const grid = (
      <PlayerGrid
        players={state.players}
        youId={state.you.playerId}
        rule={gridRule}
        selected={gridSelected}
        allowedIds={allowedIds}
        onToggle={onToggle}
        presentation={stage === 'voting' ? (isRevote ? 'revote' : 'voting') : 'night'}
      />
    );
    if (isRevote) {
      const board = revoteBoardCopy();
      return (
        <article className="ww-revote" aria-label="Revote">
          <div className="ww-revote-board">
            <h2 className="ww-revote-title">{board.title}</h2>
            <p className="ww-revote-guide">{board.guide}</p>
            {grid}
          </div>
        </article>
      );
    }
    return (
      <>
        {tally}
        {report}
        {panel}
        {kill}
        {grid}
      </>
    );
  }

  const grid = STAGE_SPECS[stage].foreground === 'player-grid';
  const dayBoard = stage === 'day';
  return (
    <>
      {tally}
      {report}
      {privateSurface ? panel : null}
      {kill}
      <ul className={dayBoard ? 'ww-seats ww-day-seats' : 'ww-seats'} aria-label={grid ? 'Players' : 'Seated players'}>
        {state.players.map((player) => (
          <li key={player.playerId} className="ww-seat" data-life={player.lifeStatus}>
            <PlayerAvatar name={player.displayName} avatarId={player.avatarId} dead={player.lifeStatus === 'DEAD'} />
            <span className="ww-seat-name">{dayBoard ? `#${player.seatNumber} ${player.displayName}` : player.displayName}</span>
            <span className="ww-seat-life" data-life={player.lifeStatus}>
              {dayBoard ? <span className="ww-seat-life-dot" aria-hidden="true" /> : null}
              {lifeLabel(player.lifeStatus)}
            </span>
            {dayBoard ? null : player.isHost ? <span className="ww-seat-tag">Host</span> : null}
            {dayBoard ? null : player.playerId === state.you.playerId ? <span className="ww-seat-tag">You</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Public Seeker publications and Ghost hints get a distinct tone in the report. */
function noteTone(line: string): string {
  if (/published a result/i.test(line)) return 'published';
  if (/hint from beyond/i.test(line)) return 'ghost';
  if (/silenced today/i.test(line)) return 'silenced';
  return 'note';
}
