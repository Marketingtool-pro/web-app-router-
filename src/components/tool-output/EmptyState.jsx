import PropTypes from 'prop-types';

// @mui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// @assets
import { IconSparkles } from '@tabler/icons-react';

/***************************  EMPTY STATE  ***************************/

// One shape for "nothing here yet" across the tool pages: before a run, an unknown
// tool slug, an empty history. Real empty — never filled with sample data.

export default function EmptyState({ icon, title, description, actionLabel, onAction, compact = false }) {
  return (
    <Stack
      role="status"
      sx={{ alignItems: 'center', textAlign: 'center', gap: 1.25, py: compact ? 3 : 6, px: 2 }}
    >
      <Box
        sx={{
          width: compact ? 44 : 56,
          height: compact ? 44 : 56,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {icon || <IconSparkles size={compact ? 20 : 24} />}
      </Box>
      <Typography variant={compact ? 'subtitle1' : 'h6'} sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="outlined" size="small" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  compact: PropTypes.bool
};
