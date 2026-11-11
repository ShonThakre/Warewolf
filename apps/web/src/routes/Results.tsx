import { Button } from '@mui/material';
import { Link, useParams } from 'react-router';
import { VillageScene } from '../game/components/VillageScene';
import { VictoryBanner } from '../game/components/VictoryBanner';
import { GameLayout } from '../game/layout';

/**
 * Results shell. The winning team, ribbon, and recap arrive with the results
 * projection (WW-1203). Until then the page names the game and does not invent a winner.
 */
export function Results() {
  const { gameId } = useParams();
  return (
    <GameLayout
      stage="results"
      status={
        <>
          <h1 className="ww-victory-title">Results</h1>
          {gameId ? <p className="ww-victory-reason">Game {gameId}</p> : null}
        </>
      }
      scene={<VillageScene scene="square_dusk" />}
      foreground={<VictoryBanner title="Waiting for the result" reason="The winning team and the ribbon appear when the game ends." />}
      rail={<p className="ww-victory-reason">The recap lists each seat after the result is ready. A cancelled game does not reveal roles.</p>}
      action={
        <Button component={Link} to="/" variant="contained" color="secondary">
          Play again
        </Button>
      }
    />
  );
}
