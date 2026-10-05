import PropTypes from 'prop-types';
import { Fragment, useMemo, useState } from 'react';

// @mui
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// @assets
import { IconCheck, IconChevronDown, IconChevronUp, IconCopy } from '@tabler/icons-react';

// @project
import { blockToPlainText, parseInline, parseMarkdown, splitSections } from './markdown';

/***************************  MARKDOWN RENDERER  ***************************/

// Renders AI tool output as formatted text: H1–H4, lists, bold/italic, inline and
// block code, quotes, tables and safe links. Copy fidelity is preserved because the
// caller always copies the original markdown, never the rendered DOM.
// Large outputs start collapsed; past `maxRenderChars` only a preview is rendered and
// the reader is pointed at the download instead of expanding a huge DOM.

const HEADING_VARIANT = { 1: 'h4', 2: 'h5', 3: 'h6', 4: 'subtitle1' };
const codeSx = {
  fontFamily: 'monospace',
  fontSize: '0.92em',
  px: 0.6,
  py: 0.1,
  borderRadius: 1,
  bgcolor: 'rgba(255,255,255,0.06)'
};

const INLINE = {
  bold: (t, k) => (
    <Box key={k} component="strong" sx={{ fontWeight: 700, color: 'text.primary' }}>
      {t.value}
    </Box>
  ),
  italic: (t, k) => (
    <Box key={k} component="em">
      {t.value}
    </Box>
  ),
  code: (t, k) => (
    <Box key={k} component="code" sx={codeSx}>
      {t.value}
    </Box>
  ),
  link: (t, k) => (
    <Link key={k} href={t.href} target="_blank" rel="noopener noreferrer nofollow" underline="hover">
      {t.value}
    </Link>
  ),
  text: (t, k) => <Fragment key={k}>{t.value}</Fragment>
};

function Inline({ text }) {
  return parseInline(text).map((t, i) => INLINE[t.type](t, i));
}

function CopySectionButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked by the browser — leave the icon unchanged
    }
  };
  return (
    <Tooltip title={copied ? 'Copied' : 'Copy section'}>
      <IconButton size="small" onClick={copy} aria-label="Copy section" sx={{ color: 'text.secondary', '@media print': { display: 'none' } }}>
        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      </IconButton>
    </Tooltip>
  );
}

const bodySx = { color: 'text.secondary', lineHeight: 1.75 };

function HeadingBlock({ block, sectionText }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: block.level <= 2 ? 2.5 : 2, mb: 1 }}>
      <Typography variant={HEADING_VARIANT[block.level]} component={`h${block.level + 1}`} sx={{ fontWeight: 700, flex: 1 }}>
        <Inline text={block.text} />
      </Typography>
      {sectionText && <CopySectionButton text={sectionText} />}
    </Stack>
  );
}

function ListBlock({ block }) {
  return (
    <Box
      component={block.type}
      start={block.start}
      sx={{ ...bodySx, pl: 3, my: 1, '& li': { mb: 0.5 }, '& li::marker': { color: 'primary.main' } }}
    >
      {block.items.map((it, i) => (
        <Typography key={i} component="li" variant="body2" sx={bodySx}>
          <Inline text={it} />
        </Typography>
      ))}
    </Box>
  );
}

function TableBlock({ block }) {
  const cell = { p: 1, borderBottom: '1px solid' };
  return (
    <Box sx={{ overflowX: 'auto', my: 1.5 }}>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {block.header.map((h, i) => (
              <Box key={i} component="th" sx={{ ...cell, textAlign: 'left', color: 'text.primary', fontWeight: 600, borderColor: 'divider' }}>
                <Inline text={h} />
              </Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <Box key={ci} component="td" sx={{ ...cell, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Inline text={c} />
                </Box>
              ))}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

const BLOCKS = {
  heading: HeadingBlock,
  paragraph: ({ block }) => (
    <Typography variant="body2" sx={{ ...bodySx, mb: 1.5 }}>
      <Inline text={block.text} />
    </Typography>
  ),
  ul: ListBlock,
  ol: ListBlock,
  code: ({ block }) => (
    <Box
      component="pre"
      sx={{
        m: 0,
        my: 1.5,
        p: 2,
        borderRadius: 2,
        bgcolor: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto',
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 1.6
      }}
    >
      <code>{block.text}</code>
    </Box>
  ),
  quote: ({ block }) => (
    <Box sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 2, my: 1.5 }}>
      <Typography variant="body2" sx={{ ...bodySx, fontStyle: 'italic' }}>
        <Inline text={block.text} />
      </Typography>
    </Box>
  ),
  hr: () => <Box component="hr" sx={{ border: 0, height: '1px', bgcolor: 'divider', my: 2 }} />,
  table: TableBlock
};

function Block({ block, sectionText }) {
  const Component = BLOCKS[block.type];
  return Component ? <Component block={block} sectionText={sectionText} /> : null;
}

// Flatten sections into rendered blocks, stopping at `limit`. The first block of a
// titled section carries that section's plain text for the copy button.
function renderBlocks(sections, limit, sectionCopy) {
  const out = [];
  for (const [si, section] of sections.entries()) {
    const sectionText = sectionCopy && section.title ? section.blocks.map(blockToPlainText).filter(Boolean).join('\n\n') : null;
    for (const [bi, block] of section.blocks.entries()) {
      if (out.length >= limit) return out;
      out.push(<Block key={`${si}-${bi}`} block={block} sectionText={bi === 0 ? sectionText : null} />);
    }
  }
  return out;
}

function TooLargeNotice({ onDownload }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mt: 2 }}>
      <Typography variant="caption" color="text.secondary">
        This result is too large to show in full here.
      </Typography>
      {onDownload && (
        <Button size="small" variant="outlined" onClick={onDownload}>
          Download full result
        </Button>
      )}
    </Stack>
  );
}

// Decide how much of the output to render: everything, a collapsible preview, or
// (past maxRenderChars) a fixed preview with a download offer.
function useRenderPlan(text, { collapseAt, collapsedBlocks, maxRenderChars }) {
  const tooLarge = text.length > maxRenderChars;
  const sections = useMemo(
    () => splitSections(parseMarkdown(tooLarge ? text.slice(0, collapseAt) : text)),
    [text, tooLarge, collapseAt]
  );
  const totalBlocks = sections.reduce((n, s) => n + s.blocks.length, 0);
  const collapsible = !tooLarge && text.length > collapseAt && totalBlocks > collapsedBlocks;
  return { sections, tooLarge, collapsible };
}

function CollapseToggle({ expanded, onToggle }) {
  return (
    <Button
      size="small"
      onClick={onToggle}
      endIcon={expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
      sx={{ mt: 1, '@media print': { display: 'none' } }}
    >
      {expanded ? 'Show less' : 'Show full result'}
    </Button>
  );
}

export default function MarkdownRenderer({
  content,
  collapseAt = 6000,
  collapsedBlocks = 12,
  maxRenderChars = 500000,
  sectionCopy = true,
  onDownload
}) {
  const [expanded, setExpanded] = useState(false);
  const { sections, tooLarge, collapsible } = useRenderPlan(String(content ?? ''), { collapseAt, collapsedBlocks, maxRenderChars });
  const showAll = !tooLarge && (!collapsible || expanded);

  return (
    <Box sx={{ wordBreak: 'break-word', '& > :first-of-type': { mt: 0 } }} data-testid="markdown-renderer">
      {renderBlocks(sections, showAll ? Infinity : collapsedBlocks, sectionCopy)}
      {collapsible && <CollapseToggle expanded={expanded} onToggle={() => setExpanded((v) => !v)} />}
      {tooLarge && <TooLargeNotice onDownload={onDownload} />}
    </Box>
  );
}

Inline.propTypes = { text: PropTypes.string };
CopySectionButton.propTypes = { text: PropTypes.string };
TooLargeNotice.propTypes = { onDownload: PropTypes.func };
CollapseToggle.propTypes = { expanded: PropTypes.bool, onToggle: PropTypes.func };
Block.propTypes = { block: PropTypes.object, sectionText: PropTypes.string };
HeadingBlock.propTypes = { block: PropTypes.object, sectionText: PropTypes.string };
ListBlock.propTypes = { block: PropTypes.object };
TableBlock.propTypes = { block: PropTypes.object };
MarkdownRenderer.propTypes = {
  content: PropTypes.string,
  collapseAt: PropTypes.number,
  collapsedBlocks: PropTypes.number,
  maxRenderChars: PropTypes.number,
  sectionCopy: PropTypes.bool,
  onDownload: PropTypes.func
};
