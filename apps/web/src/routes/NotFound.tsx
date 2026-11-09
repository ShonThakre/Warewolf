import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router';

export function NotFound() {
  return (
    <Box sx={{ p: 'var(--space)', display: 'grid', placeItems: 'center', minHeight: '100%', textAlign: 'center' }}>
      <div>
        <Typography component="h1" sx={{ fontSize: 'var(--text-title)', fontWeight: 700 }}>
          Page not found
        </Typography>
        <Button component={Link} to="/" variant="contained" sx={{ mt: 2 }}>
          Back to home
        </Button>
      </div>
    </Box>
  );
}
