import { skipToken } from '@reduxjs/toolkit/query/react';
import type { GameConfiguration } from '@warewolf/domain';
import { validateConfiguration } from '@warewolf/domain';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiErrorOf, type ApiErrorInfo } from '../api/api';
import { useStartGameMutation } from '../api/game';
import { useGetConfigurationQuery, useSaveConfigurationMutation } from '../api/lobby';
import { acknowledgementCopy, explainIssue, startSentences } from '../game/components/lobbyCopy';
import { useLayoutMode } from '../game/layout';
import { ConfigSummary } from '../game/setup/ConfigSummary';
import { SetupLayout } from '../game/setup/SetupLayout';
import { SetupMode } from '../game/setup/SetupMode';
import { SetupRoles } from '../game/setup/SetupRoles';
import { SetupSettings } from '../game/setup/SetupSettings';
import { lockedModeCopy } from '../game/setup/setupCopy';
import { sameConfiguration, type SetupStep } from '../game/setup/setupDraft';
import { useLobby, useSeat } from '../game/state/lobby';
import { gamePath } from '../game/state/role';

/** Members only. The host edits. Everyone else sees the same summary and waits. */
export function Setup() {
  const seat = useSeat();
  const { gameId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!seat) {
      navigate('/', { replace: true });
      return;
    }
    if (gameId !== seat.gameId) navigate(`/lobby/${seat.gameId}/setup`, { replace: true });
  }, [seat, gameId, navigate]);

  if (!seat || gameId !== seat.gameId) return null;
  return <SetupScreen />;
}

function SetupScreen() {
  const { lobby, isLoading, error } = useLobby();
  const configuration = useGetConfigurationQuery(lobby?.status === 'LOBBY' ? lobby.gameId : skipToken);
  const layout = useLayoutMode();
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>('mode');
  const [draft, setDraft] = useState<GameConfiguration | null>(null);
  const [baseline, setBaseline] = useState<GameConfiguration | null>(null);
  const [saveError, setSaveError] = useState<ApiErrorInfo | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [startError, setStartError] = useState<ApiErrorInfo | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [saveConfiguration, saveState] = useSaveConfigurationMutation();
  const [startGame, startState] = useStartGameMutation();

  const serverDraft = configuration.data?.draft;

  useEffect(() => {
    if (!serverDraft || baseline) return;
    const next = structuredClone(serverDraft) as GameConfiguration;
    setDraft(next);
    setBaseline(structuredClone(serverDraft) as GameConfiguration);
  }, [serverDraft, baseline]);

  useEffect(() => {
    if (!lobby || lobby.status === 'LOBBY') return;
    const next = gamePath(lobby.gameId, lobby.status, lobby.phase);
    if (next) navigate(next, { replace: true });
  }, [lobby, navigate]);

  if ((isLoading && !lobby) || (lobby?.status === 'LOBBY' && !draft && !configuration.error)) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Game setup</h1>
        <p className="ww-status-copy">Opening the setup…</p>
      </div>
    );
  }

  if (!lobby || lobby.status === 'CANCELLED') {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Game setup</h1>
        <p className="ww-status-copy">{lobby?.status === 'CANCELLED' ? 'This room was cancelled.' : (error?.message ?? 'The setup could not be opened.')}</p>
        <Button component={Link} to="/" variant="contained">
          Back to home
        </Button>
      </div>
    );
  }

  if (!draft || configuration.error) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Game setup</h1>
        <p className="ww-status-copy">{apiErrorOf(configuration.error)?.message ?? error?.message ?? 'The setup could not be opened.'}</p>
        <Button component={Link} to={`/lobby/${lobby.gameId}`}>
          Back to the lobby
        </Button>
      </div>
    );
  }

  const editable = configuration.data?.editable === true && lobby.you.isHost && lobby.status === 'LOBBY';
  const validation = validateConfiguration(draft);
  const dirty = baseline != null && !sameConfiguration(draft, baseline);
  const problems = validation.errors.map(explainIssue);
  const localWarnings = validation.warnings.map(explainIssue);
  const serverWarnings = configuration.data ? configuration.data.validation.warnings.map(explainIssue) : null;
  const acknowledgement = acknowledgementCopy({
    local: localWarnings,
    server: dirty ? null : serverWarnings,
    loading: configuration.isLoading || configuration.isFetching,
    required: lobby.start.requiresWarningAcknowledgement || localWarnings.length > 0,
  });
  const warningLines = acknowledgement.lines.length > 0 ? acknowledgement.lines : localWarnings;
  const sentences = startSentences({
    status: lobby.status,
    ready: lobby.start.ready && validation.valid && !dirty,
    blockers: validation.valid ? lobby.start.blockers : ['CONFIG_INVALID'],
    requiresWarningAcknowledgement: lobby.start.requiresWarningAcknowledgement || warningLines.length > 0,
    seated: lobby.players.length,
    seats: draft.playerCount,
    problems,
    warnings: acknowledgement.lines,
  });
  const busy = saveState.isLoading || startState.isLoading;
  const startDisabled = !editable || dirty || !validation.valid || !lobby.start.ready || busy;

  function onDraft(next: GameConfiguration) {
    setDraft((current) => (current === next ? current : next));
    setSaveError(null);
    setJustSaved(false);
  }

  async function save() {
    if (!draft || !editable) return;
    const result = await saveConfiguration({ gameId: lobby!.gameId, draft });
    if ('data' in result && result.data) {
      const saved = structuredClone(result.data.draft) as GameConfiguration;
      setDraft(saved);
      setBaseline(structuredClone(result.data.draft) as GameConfiguration);
      setSaveError(null);
      setJustSaved(true);
      return;
    }
    setSaveError(apiErrorOf('error' in result ? result.error : null));
  }

  async function begin(acknowledgeWarnings: boolean) {
    const result = await startGame({ gameId: lobby!.gameId, acknowledgeWarnings });
    if ('data' in result && result.data) {
      setWarnOpen(false);
      const next = gamePath(result.data.gameId, result.data.status, result.data.phase);
      if (next) navigate(next, { replace: true });
      return;
    }
    setStartError(apiErrorOf('error' in result ? result.error : null));
  }

  const reasonLines = !editable
    ? ['Waiting for the host.']
    : !validation.valid
      ? problems
      : dirty
        ? ['Save the setup before starting.']
        : sentences;

  return (
    <>
      <SetupLayout
        step={step}
        onStep={setStep}
        oneStep={layout.mode === 'portrait'}
        summary={
          <ConfigSummary
            mode={draft.mode}
            summary={validation.summary}
            detail={layout.height >= 500}
            errors={validation.errors}
            warnings={validation.warnings}
          />
        }
        canvas={
          <>
            {step === 'mode' ? <SetupMode draft={draft} editable={editable} onDraft={onDraft} /> : null}
            {step === 'roles' ? <SetupRoles draft={draft} editable={editable} onDraft={onDraft} /> : null}
            {step === 'settings' ? <SetupSettings draft={draft} editable={editable} onDraft={onDraft} /> : null}
            {step === 'review' ? (
              <Review
                mode={draft.mode}
                valid={validation.valid}
                errors={problems}
                warnings={warningLines}
              />
            ) : null}
          </>
        }
        action={
          <>
            <Button className="ww-setup-back" variant="outlined" component={Link} to={`/lobby/${lobby.gameId}`}>
              <span aria-hidden="true">← </span>
              Back to the lobby
            </Button>
            <div className="ww-setup-action-cluster">
              {editable && (saveState.isLoading || dirty || justSaved) ? (
                <span className="ww-pill" data-tone={saveState.isLoading ? undefined : dirty ? 'waiting' : 'ready'} role="status">
                  {saveState.isLoading ? 'Saving…' : dirty ? 'Unsaved changes' : '✓ Saved'}
                </span>
              ) : null}
              {saveError ? <Alert severity="error">{saveError.message}</Alert> : null}
              {startError ? <Alert severity="error">{startError.message}</Alert> : null}
              {editable ? (
                <Button color="secondary" variant={dirty ? 'contained' : 'outlined'} disabled={!dirty || busy} onClick={() => void save()}>
                  {saveState.isLoading ? 'Saving…' : 'Save setup'}
                </Button>
              ) : null}
              {editable ? (
                <div className="ww-setup-start">
                  <Button
                    color="primary"
                    variant="contained"
                    disabled={startDisabled}
                    aria-describedby="setup-reasons"
                    onClick={() => {
                      setStartError(null);
                      if (lobby.start.requiresWarningAcknowledgement || localWarnings.length > 0 || acknowledgement.lines.length > 0) setWarnOpen(true);
                      else void begin(false);
                    }}
                  >
                    {startState.isLoading ? 'Starting…' : 'Start game'}
                  </Button>
                  <div className="ww-setup-reasons" id="setup-reasons">
                    {reasonLines.map((line, index) => (
                      <p key={`${index}-${line}`} className="ww-setup-copy">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ww-setup-reasons" id="setup-reasons">
                  {reasonLines.map((line, index) => (
                    <p key={`${index}-${line}`} className="ww-setup-copy">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />
      <Dialog open={warnOpen} onClose={() => (startState.isLoading ? undefined : setWarnOpen(false))} fullWidth maxWidth="xs" aria-labelledby="setup-warn-title">
        <DialogTitle id="setup-warn-title">Acknowledge warnings</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          {acknowledgement.loading ? <p className="ww-setup-copy">Loading the warnings…</p> : null}
          {acknowledgement.lines.map((message) => (
            <p key={message} className="ww-setup-copy">
              {message}
            </p>
          ))}
          {startError ? <Alert severity="error">{startError.message}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWarnOpen(false)} disabled={startState.isLoading}>
            Cancel
          </Button>
          <Button variant="contained" color="secondary" disabled={acknowledgement.loading || startDisabled || startState.isLoading} onClick={() => void begin(true)}>
            Start the game
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Review({ mode, valid, errors, warnings }: { mode: GameConfiguration['mode']; valid: boolean; errors: readonly string[]; warnings: readonly string[] }) {
  const lockedCopy = lockedModeCopy(mode);
  return (
    <>
      {lockedCopy ? <p className="ww-setup-copy">{lockedCopy} Start waits until every seat is filled.</p> : null}
      {valid ? <p className="ww-setup-copy">This setup can start once the room is full and any warnings are acknowledged.</p> : null}
      {errors.map((line) => (
        <p key={line} className="ww-setup-issue ww-setup-issue-error">
          {line}
        </p>
      ))}
      {warnings.map((line) => (
        <p key={line} className="ww-setup-issue">
          {line}
        </p>
      ))}
    </>
  );
}
