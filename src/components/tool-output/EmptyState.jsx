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

const SIZES = {
  regular: { py: 6, circle: 56, iconSize: 24, titleVariant: 'h6' },
  compact: { py: 3, circle: 44, iconSize: 20, titleVariant: 'subtitle1' }
};

export default function EmptyState({ icon, title, description, actionLabel, onAction, compact = false }) {
  const size = SIZES[compact ? 'compact' : 'regular'];
  const showAction = Boolean(actionLabel && onAction);
  return (
    <Stack
      role="status"
      sx={{ alignItems: 'center', textAlign: 'center', gap: 1.25, py: size.py, px: 2 }}
    >
      <Box
        sx={{
          width: size.circle,
          height: size.circle,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        {icon || <IconSparkles size={size.iconSize} />}
      </Box>
      <Typography variant={size.titleVariant} sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {showAction && (
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
