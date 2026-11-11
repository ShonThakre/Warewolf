import type { Faction } from '@warewolf/domain';
import { Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { sceneArtUrl, uiArtUrl, type SceneId } from '../assets/art';
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

  const scene = role ? sceneArtUrl(REVEAL_SCENE[role.currentRole.faction]) : null;
  const back = uiArtUrl('card_back');
  const picture = covered ? back : scene;

  return (
    <div className="ww-reveal">
      <div className="ww-reveal-art" aria-hidden="true">
        {picture ? <img src={picture} alt="" /> : <div className="ww-reveal-art-fallback" />}
      </div>
      <section className="ww-reveal-panel" aria-label="Your role">
        <div className="ww-reveal-scroll">
          {isLoading && !role ? <p className="ww-reveal-status">Opening your role…</p> : null}
          {error && error.code !== 'PHASE_CONFLICT' && !role ? (
            <>
              <p className="ww-reveal-status">{error.message}</p>
              <Button onClick={() => refetch()}>Try again</Button>
            </>
          ) : null}
          {role ? <RoleCard role={role} covered={covered} onCover={() => setCovered(true)} onShow={() => setCovered(false)} /> : null}
        </div>
        <div className="ww-reveal-action">
          {note ? <p className="ww-reveal-status">{note}</p> : null}
          {view.state?.status === 'CANCELLED' ? (
            <p className="ww-reveal-status">This game was cancelled. Roles stay hidden.</p>
          ) : (
            <>
              {!control.canClose && view.state ? <p className="ww-reveal-status">Waiting for host</p> : null}
              <Button
                component={Link}
                to={`/game/${seat.gameId}`}
                variant={control.canClose ? 'outlined' : 'contained'}
                color={control.canClose ? 'primary' : 'secondary'}
              >
                I understand
              </Button>
            </>
          )}
          <PhaseCloseButton
            control={control}
            onClosed={(next) => {
              const path = gamePath(next.gameId, next.status, next.phase);
              if (path) navigate(path, { replace: true });
            }}
          />
        </div>
      </section>
    </div>
  );
}
