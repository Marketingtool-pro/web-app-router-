import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';

// @mui
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

// @assets
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconFileText,
  IconFileTypePdf,
  IconRefresh,
  IconRocket,
  IconShare,
  IconThumbDown,
  IconThumbDownFilled,
  IconThumbUp,
  IconThumbUpFilled
} from '@tabler/icons-react';

// @project
import { copyText, downloadTxt, printAsPdf } from './exportOutput';

/***************************  OUTPUT TOOLBAR  ***************************/

// Where a tool run finishes. Copy, TXT and PDF work on their own. Save, Regenerate,
// Share, Rate and Launch need a backend, so each one only appears when the page passes
// its handler — a button is never shown for an action that cannot work.
// Every action has its own idle → loading → success / error state, and every action
// is disabled until there is output.

const RESET_MS = 2000;

const LABELS = {
  copy: 'Copy',
  pdf: 'Save as PDF',
  txt: 'Download .txt',
  save: 'Save',
  regenerate: 'Regenerate',
  share: 'Copy share link',
  rate: 'Rate',
  launch: 'Launch'
};

export function useActionStates() {
  const [states, setStates] = useState({});
  const timers = useRef({});

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  const run = useCallback(async (key, fn) => {
    clearTimeout(timers.current[key]);
    setStates((s) => ({ ...s, [key]: { status: 'loading' } }));
    try {
      const value = await fn();
      setStates((s) => ({ ...s, [key]: { status: 'success' } }));
      timers.current[key] = setTimeout(() => setStates((s) => ({ ...s, [key]: { status: 'idle' } })), RESET_MS);
      return value;
    } catch (err) {
      setStates((s) => ({ ...s, [key]: { status: 'error', message: err?.message || 'Something went wrong' } }));
      return undefined;
    }
  }, []);

  return [states, run];
}

function ActionButton({ id, label, icon, state, disabled, onClick, successLabel }) {
  const status = state?.status || 'idle';
  const title =
    status === 'error' ? `${label} failed: ${state.message}` : status === 'success' ? successLabel || 'Done' : label;
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          data-action={id}
          data-status={status}
          disabled={disabled || status === 'loading'}
          onClick={onClick}
          sx={{ color: status === 'error' ? 'error.main' : status === 'success' ? 'success.main' : 'text.secondary' }}
        >
          {status === 'loading' ? (
            <CircularProgress size={16} color="inherit" />
          ) : status === 'success' ? (
            <IconCheck size={18} />
          ) : status === 'error' ? (
            <IconAlertTriangle size={18} />
          ) : (
            icon
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default function OutputToolbar({
  output,
  title = 'Result',
  fileName,
  onSave,
  onRegenerate,
  onShare,
  onRate,
  onLaunch,
  regenerating = false,
  saved = false
}) {
  const [states, run] = useActionStates();
  const [rating, setRating] = useState(null);
  const hasOutput = typeof output === 'string' && output.trim().length > 0;
  const disabled = !hasOutput;

  const rate = (thumb) =>
    run('rate', async () => {
      await onRate({ thumb });
      setRating(thumb);
    });

  return (
    <Stack
      direction="row"
      role="toolbar"
      aria-label="Result actions"
      sx={{ alignItems: 'center', gap: 0.5, flexWrap: 'wrap', '@media print': { display: 'none' } }}
    >
      <ActionButton
        id="copy"
        label={LABELS.copy}
        successLabel="Copied"
        icon={<IconCopy size={18} />}
        state={states.copy}
        disabled={disabled}
        onClick={() => run('copy', () => copyText(output))}
      />
      <ActionButton
        id="txt"
        label={LABELS.txt}
        successLabel="Downloaded"
        icon={<IconFileText size={18} />}
        state={states.txt}
        disabled={disabled}
        onClick={() => run('txt', async () => downloadTxt(output, fileName || title))}
      />
      <ActionButton
        id="pdf"
        label={LABELS.pdf}
        successLabel="Print dialog opened"
        icon={<IconFileTypePdf size={18} />}
        state={states.pdf}
        disabled={disabled}
        onClick={() => run('pdf', () => printAsPdf(output, title))}
      />

      {(onSave || onRegenerate || onShare || onRate || onLaunch) && (
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />
      )}

      {onSave && (
        <ActionButton
          id="save"
          label={saved ? 'Saved' : LABELS.save}
          successLabel="Saved"
          icon={saved ? <IconCheck size={18} /> : <IconDeviceFloppy size={18} />}
          state={states.save}
          disabled={disabled || saved}
          onClick={() => run('save', onSave)}
        />
      )}
      {onRegenerate && (
        <ActionButton
          id="regenerate"
          label={LABELS.regenerate}
          icon={regenerating ? <CircularProgress size={16} color="inherit" /> : <IconRefresh size={18} />}
          state={states.regenerate}
          disabled={disabled || regenerating}
          onClick={() => run('regenerate', onRegenerate)}
        />
      )}
      {onShare && (
        <ActionButton
          id="share"
          label={LABELS.share}
          successLabel="Share link copied"
          icon={<IconShare size={18} />}
          state={states.share}
          disabled={disabled}
          onClick={() =>
            run('share', async () => {
              const url = await onShare();
              if (url) await copyText(url);
            })
          }
        />
      )}
      {onRate && (
        <>
          <ActionButton
            id="rate-up"
            label="Good result"
            successLabel="Thanks for rating"
            icon={rating === 'up' ? <IconThumbUpFilled size={18} /> : <IconThumbUp size={18} />}
            state={rating === 'up' ? states.rate : undefined}
            disabled={disabled || states.rate?.status === 'loading'}
            onClick={() => rate('up')}
          />
          <ActionButton
            id="rate-down"
            label="Poor result"
            successLabel="Thanks for rating"
            icon={rating === 'down' ? <IconThumbDownFilled size={18} /> : <IconThumbDown size={18} />}
            state={rating === 'down' ? states.rate : undefined}
            disabled={disabled || states.rate?.status === 'loading'}
            onClick={() => rate('down')}
          />
        </>
      )}
      {onLaunch && (
        <ActionButton
          id="launch"
          label={LABELS.launch}
          successLabel="Campaign draft created"
          icon={<IconRocket size={18} />}
          state={states.launch}
          disabled={disabled}
          onClick={() => run('launch', onLaunch)}
        />
      )}
    </Stack>
  );
}

ActionButton.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
  icon: PropTypes.node,
  state: PropTypes.object,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  successLabel: PropTypes.string
};

OutputToolbar.propTypes = {
  output: PropTypes.string,
  title: PropTypes.string,
  fileName: PropTypes.string,
  onSave: PropTypes.func,
  onRegenerate: PropTypes.func,
  onShare: PropTypes.func,
  onRate: PropTypes.func,
  onLaunch: PropTypes.func,
  regenerating: PropTypes.bool,
  saved: PropTypes.bool
};
