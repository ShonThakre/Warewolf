import type { Faction } from '@warewolf/domain';
import { Button } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { sceneArtUrl, type SceneId } from '../assets/art';
import { PhaseCloseButton } from '../game/components/PhaseCloseButton';
import { phaseActionNote } from '../game/components/phaseCopy';
import { RoleCard } from '../game/components/RoleCard';
import { useSeat } from '../game/state/lobby';
import { useClosePhase, useGameState } from '../game/state/phase';
import { gamePath, useMyRole } from '../game/state/role';
import '../game/components/reveal-screen.css';

const REVEAL_SCENE: Record<Faction, SceneId> = {
  WOLF_PACK: 'reveal_wolf',
  VILLAGE: 'reveal_village',
  NEUTRAL: 'reveal_neutral',
  INDEPENDENT: 'reveal_independent',
};

function EyeIcon() {
  return (
    <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4.5l18 15" />
      <path d="M9.8 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.2-1" />
      <path d="M6.2 6.7C4.3 8 2.9 9.8 2 12c1.2 2.9 5.2 6.5 10 6.5 1.3 0 2.5-.3 3.6-.7" />
      <path d="M10.2 5.6A11 11 0 0 1 12 5.5c4.8 0 8.8 3.6 10 6.5-.4 1-1.1 2.1-2.1 3.1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="ww-role-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

/** Private role scene. A missing seat returns home. A seat in another room returns to that lobby. */
export function Reveal() {
  const seat = useSeat();
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { role, isLoading, error, refetch } = useMyRole();
  const view = useGameState();
  const control = useClosePhase(view.state);
  const [covered, setCovered] = useState(false);
  const note = phaseActionNote(control.error);

  useEffect(() => {
    if (!seat) {
      navigate('/', { replace: true });
      return;
    }
    if (gameId && gameId !== seat.gameId) {
      navigate(`/lobby/${seat.gameId}`, { replace: true });
      return;
    }
    if (error?.code === 'PHASE_CONFLICT') navigate(`/lobby/${seat.gameId}`, { replace: true });
  }, [seat, gameId, error, navigate]);

  useEffect(() => {
    const state = view.state;
    if (!state || (state.status === 'ACTIVE' && state.phase === 'ROLE_REVEAL')) return;
    const next = gamePath(state.gameId, state.status, state.phase);
    if (next) navigate(next, { replace: true });
  }, [view.state, navigate]);

  if (!seat || gameId !== seat.gameId) return null;

  const picture = role && !covered ? sceneArtUrl(REVEAL_SCENE[role.currentRole.faction]) : null;

  let actions: ReactNode = null;
  if (role) {
    const hide = (
      <Button className="ww-reveal-hide" variant="outlined" startIcon={covered ? <EyeIcon /> : <EyeOffIcon />} onClick={() => setCovered((value) => !value)}>
        {covered ? 'Show role' : 'Hide role'}
      </Button>
    );
    actions =
      view.state?.status === 'CANCELLED' ? (
        <div className="ww-role-foot">
          <p className="ww-reveal-status">This game was cancelled. Roles stay hidden.</p>
          <div className="ww-role-actions">{hide}</div>
        </div>
      ) : (
        <div className="ww-role-foot">
          {note ? <p className="ww-reveal-status">{note}</p> : null}
          {!control.canClose && view.state ? (
            <p className="ww-reveal-status">Read your role, then go to the table. The host starts the game when everyone is ready.</p>
          ) : null}
          {control.canClose ? <p className="ww-reveal-status">When everyone has read their role, move the game on.</p> : null}
          <div className="ww-role-actions">
            {hide}
            <Button
              className="ww-reveal-go"
              component={Link}
              to={`/game/${seat.gameId}`}
              variant="contained"
              color="primary"
              startIcon={<CheckIcon />}
            >
              I understand
            </Button>
          </div>
          {control.canClose ? (
            <div className="ww-reveal-close">
              <PhaseCloseButton
                control={control}
                tone="secondary"
                onClosed={(next) => {
                  const path = gamePath(next.gameId, next.status, next.phase);
                  if (path) navigate(path, { replace: true });
                }}
              />
            </div>
          ) : null}
        </div>
      );
  }

  return (
    <div className="ww-reveal" data-covered={covered ? 'true' : undefined} data-faction={role && !covered ? role.currentRole.faction : undefined}>
      <div className="ww-reveal-scene" aria-hidden="true">
        {picture ? <img src={picture} alt="" /> : <div className="ww-reveal-art-fallback" />}
        <div className="ww-reveal-wash" />
      </div>
      <section className="ww-reveal-panel" aria-label="Your role">
        {isLoading && !role ? <p className="ww-reveal-status">Opening your role…</p> : null}
        {error && error.code !== 'PHASE_CONFLICT' && !role ? (
          <div className="ww-reveal-pending">
            <p className="ww-reveal-status">{error.message}</p>
            <Button onClick={() => refetch()}>Try again</Button>
          </div>
        ) : null}
        {role ? (
          <RoleCard role={role} covered={covered}>
            {actions}
          </RoleCard>
        ) : null}
      </section>
    </div>
  );
}
