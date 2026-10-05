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

const STATUS_COLOR = { error: 'error.main', success: 'success.main' };
const STATUS_ICON = {
  loading: <CircularProgress size={16} color="inherit" />,
  success: <IconCheck size={18} />,
  error: <IconAlertTriangle size={18} />
};

function tooltipFor(label, state, successLabel) {
  if (state?.status === 'error') return `${label} failed: ${state.message}`;
  if (state?.status === 'success') return successLabel || 'Done';
  return label;
}

function ActionButton({ id, label, icon, state, disabled, onClick, successLabel }) {
  const status = state?.status || 'idle';
  return (
    <Tooltip title={tooltipFor(label, state, successLabel)}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          data-action={id}
          data-status={status}
          disabled={disabled || status === 'loading'}
          onClick={onClick}
          sx={{ color: STATUS_COLOR[status] || 'text.secondary' }}
        >
          {STATUS_ICON[status] || icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function RateButtons({ onRate, states, run, disabled }) {
  const [rating, setRating] = useState(null);
  const rate = (thumb) =>
    run('rate', async () => {
      await onRate({ thumb });
      setRating(thumb);
    });
  const busy = states.rate?.status === 'loading';
  return (
    <>
      <ActionButton
        id="rate-up"
        label="Good result"
        successLabel="Thanks for rating"
        icon={rating === 'up' ? <IconThumbUpFilled size={18} /> : <IconThumbUp size={18} />}
        state={rating === 'up' ? states.rate : undefined}
        disabled={disabled || busy}
        onClick={() => rate('up')}
      />
      <ActionButton
        id="rate-down"
        label="Poor result"
        successLabel="Thanks for rating"
        icon={rating === 'down' ? <IconThumbDownFilled size={18} /> : <IconThumbDown size={18} />}
        state={rating === 'down' ? states.rate : undefined}
        disabled={disabled || busy}
        onClick={() => rate('down')}
      />
    </>
  );
}

// Actions that need a backend. Each entry builds its button props from the
// toolbar props; entries whose handler the page did not pass are skipped.
const BACKEND_ACTIONS = [
  {
    handler: 'onSave',
    build: ({ onSave, saved }) => ({
      id: 'save',
      label: saved ? 'Saved' : LABELS.save,
      successLabel: 'Saved',
      icon: saved ? <IconCheck size={18} /> : <IconDeviceFloppy size={18} />,
      blocked: saved,
      fn: onSave
    })
  },
  {
    handler: 'onRegenerate',
    build: ({ onRegenerate, regenerating }) => ({
      id: 'regenerate',
      label: LABELS.regenerate,
      icon: regenerating ? STATUS_ICON.loading : <IconRefresh size={18} />,
      blocked: regenerating,
      fn: onRegenerate
    })
  },
  {
    handler: 'onShare',
    build: ({ onShare }) => ({
      id: 'share',
      label: LABELS.share,
      successLabel: 'Share link copied',
      icon: <IconShare size={18} />,
      fn: async () => {
        const url = await onShare();
        if (url) await copyText(url);
      }
    })
  },
  {
    handler: 'onLaunch',
    build: ({ onLaunch }) => ({
      id: 'launch',
      label: LABELS.launch,
      successLabel: 'Campaign draft created',
      icon: <IconRocket size={18} />,
      fn: onLaunch
    })
  }
];

function BackendActions({ states, run, disabled, ...props }) {
  const buttons = BACKEND_ACTIONS.filter((a) => props[a.handler]).map((a) => a.build(props));
  return (
    <>
      {buttons.map(({ id, fn, blocked, ...rest }) => (
        <ActionButton key={id} id={id} {...rest} state={states[id]} disabled={disabled || Boolean(blocked)} onClick={() => run(id, fn)} />
      ))}
      {props.onRate && <RateButtons onRate={props.onRate} states={states} run={run} disabled={disabled} />}
    </>
  );
}

export default function OutputToolbar({ output, title = 'Result', fileName, ...backend }) {
  const [states, run] = useActionStates();
  const disabled = !(typeof output === 'string' && output.trim().length > 0);
  const hasBackend = ['onSave', 'onRegenerate', 'onShare', 'onRate', 'onLaunch'].some((k) => backend[k]);

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
      {hasBackend && <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />}
      <BackendActions states={states} run={run} disabled={disabled} {...backend} />
    </Stack>
  );
}

RateButtons.propTypes = { onRate: PropTypes.func, states: PropTypes.object, run: PropTypes.func, disabled: PropTypes.bool };

BackendActions.propTypes = {
  states: PropTypes.object,
  run: PropTypes.func,
  disabled: PropTypes.bool,
  onSave: PropTypes.func,
  onRegenerate: PropTypes.func,
  onShare: PropTypes.func,
  onRate: PropTypes.func,
  onLaunch: PropTypes.func,
  regenerating: PropTypes.bool,
  saved: PropTypes.bool
};

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
