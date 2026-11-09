import { Box, Paper, Typography } from '@mui/material';
import { useParams } from 'react-router';

export interface PlaceholderProps {
  title: string;
  audience: string;
  /** Checklist task that replaces this placeholder. */
  task: string;
}

/** Stand-in for a screen that a later phase builds. */
export function Placeholder({ title, audience, task }: PlaceholderProps) {
  const { gameId } = useParams();
  return (
    <Box sx={{ p: 'var(--space)', display: 'grid', placeItems: 'center', minHeight: '100%' }}>
      <Paper
        sx={{ p: 'calc(var(--space) * 2)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', maxWidth: 560, width: '100%' }}
      >
        <Typography component="h1" sx={{ fontSize: 'var(--text-title)', fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography sx={{ color: 'var(--text-muted)', mt: 1 }}>{audience}</Typography>
        {gameId ? <Typography sx={{ mt: 1, fontSize: 'var(--text-label)' }}>Game {gameId}</Typography> : null}
        <Typography sx={{ mt: 2, fontSize: 'var(--text-label)', color: 'var(--text-muted)' }}>
          Placeholder. Built in {task}.
        </Typography>
      </Paper>
    </Box>
  );
}
