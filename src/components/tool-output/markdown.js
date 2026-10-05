/***************************  TOOL OUTPUT - MARKDOWN PARSER  ***************************/

// Small, dependency-free markdown parser for AI tool output.
// Covers what the Windmill engines actually emit: # to #### headings, paragraphs,
// - / * / + bullets, 1. numbered lists, ``` fenced code, > quotes, --- rules,
// | pipe | tables, and inline **bold**, *italic*, `code` and [links](https://...).
// It never produces raw HTML, so the renderer cannot be used for injection.

const SAFE_URL = /^(https?:|mailto:)/i;

/** True only for http(s) and mailto URLs — everything else renders as plain text. */
export function isSafeUrl(url) {
  return typeof url === 'string' && SAFE_URL.test(url.trim());
}

/**
 * Split one line of text into inline tokens.
 * @returns {Array<{type:'text'|'bold'|'italic'|'code'|'link', value:string, href?:string}>}
 */
const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|(?<!\w)__[^_]+__(?!\w)|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|(?<!\w)_[^_\s][^_]*_(?!\w))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function linkToken(tok) {
  const [, label, href] = tok.match(LINK_RE);
  return isSafeUrl(href) ? { type: 'link', value: label, href } : { type: 'text', value: label };
}

// Ordered: the first rule whose prefix matches the token decides its type.
const INLINE_RULES = [
  ['`', (tok) => ({ type: 'code', value: tok.slice(1, -1) })],
  ['**', (tok) => ({ type: 'bold', value: tok.slice(2, -2) })],
  ['__', (tok) => ({ type: 'bold', value: tok.slice(2, -2) })],
  ['[', linkToken],
  ['', (tok) => ({ type: 'italic', value: tok.slice(1, -1) })]
];

const tokenFor = (tok) => INLINE_RULES.find(([prefix]) => tok.startsWith(prefix))[1](tok);

export function parseInline(text) {
  const tokens = [];
  let last = 0;
  for (const m of String(text ?? '').matchAll(INLINE_RE)) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    tokens.push(tokenFor(m[0]));
    last = m.index + m[0].length;
  }
  if (text && last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

const RE = {
  fence: /^\s*```\s*([\w+-]*)\s*$/,
  heading: /^(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^\s*([-*_])(\s*\1){2,}\s*$/,
  bullet: /^\s*[-*+]\s+(.*)$/,
  ordered: /^\s*(\d+)[.)]\s+(.*)$/,
  quote: /^\s*>\s?(.*)$/,
  tableRow: /^\s*\|.*\|\s*$/,
  tableSep: /^\s*\|[\s:|-]+\|\s*$/
};

const splitRow = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());

// Collect consecutive lines matching `re` starting at `i`; returns [matches, nextIndex].
function takeWhile(lines, i, re) {
  const out = [];
  while (i < lines.length && re.test(lines[i])) out.push(lines[i++].match(re));
  return [out, i];
}

const STARTS_BLOCK = [RE.fence, RE.heading, RE.hr, RE.bullet, RE.ordered, RE.quote, RE.tableRow];
const startsBlock = (line) => line.trim() === '' || STARTS_BLOCK.some((re) => re.test(line));

// Each reader looks at lines[i]; if it recognises a block it returns [block, nextIndex], else null.
const READERS = [
  function readFence(lines, i) {
    const fence = lines[i].match(RE.fence);
    if (!fence) return null;
    let j = i + 1;
    const code = [];
    while (j < lines.length && !RE.fence.test(lines[j])) code.push(lines[j++]);
    return [{ type: 'code', lang: fence[1] || '', text: code.join('\n') }, j + 1];
  },
  function readHeading(lines, i) {
    const h = lines[i].match(RE.heading);
    return h ? [{ type: 'heading', level: Math.min(h[1].length, 4), text: h[2] }, i + 1] : null;
  },
  function readRule(lines, i) {
    return RE.hr.test(lines[i]) ? [{ type: 'hr' }, i + 1] : null;
  },
  function readTable(lines, i) {
    const isTable = RE.tableRow.test(lines[i]) && RE.tableSep.test(lines[i + 1] ?? '');
    if (!isTable) return null;
    const [rows, next] = takeWhile(lines, i + 2, RE.tableRow);
    return [{ type: 'table', header: splitRow(lines[i]), rows: rows.map((m) => splitRow(m[0])) }, next];
  },
  function readBullets(lines, i) {
    const [items, next] = takeWhile(lines, i, RE.bullet);
    return items.length ? [{ type: 'ul', items: items.map((m) => m[1]) }, next] : null;
  },
  function readOrdered(lines, i) {
    const [items, next] = takeWhile(lines, i, RE.ordered);
    if (!items.length) return null;
    return [{ type: 'ol', start: Number(items[0][1]) || 1, items: items.map((m) => m[2]) }, next];
  },
  function readQuote(lines, i) {
    const [quote, next] = takeWhile(lines, i, RE.quote);
    return quote.length ? [{ type: 'quote', text: quote.map((m) => m[1]).join(' ') }, next] : null;
  }
];

// Paragraph: gather until a blank line or the start of another block.
function readParagraph(lines, i) {
  const para = [lines[i].trim()];
  let j = i + 1;
  while (j < lines.length && !startsBlock(lines[j])) para.push(lines[j++].trim());
  return [{ type: 'paragraph', text: para.join(' ') }, j];
}

// Some engines answer with a JSON payload rather than markdown — keep its layout.
function asJsonBlock(raw) {
  const trimmed = raw.trim();
  if (!/^[[{]/.test(trimmed)) return null;
  try {
    JSON.parse(trimmed);
    return { type: 'code', lang: 'json', text: trimmed };
  } catch {
    return null;
  }
}

/**
 * Parse markdown into a flat list of blocks.
 * Block types: heading {level 1-4}, paragraph, ul, ol {start}, code {lang}, quote, hr, table {header, rows}.
 */
export function parseMarkdown(source) {
  const raw = String(source ?? '');
  const json = asJsonBlock(raw);
  if (json) return [json];

  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      i++;
      continue;
    }
    const hit = READERS.reduce((found, read) => found || read(lines, i), null) || readParagraph(lines, i);
    blocks.push(hit[0]);
    i = hit[1];
  }
  return blocks;
}

/***************************  HTML EXPORT (for PDF / print)  ***************************/

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function inlineToHtml(text) {
  return parseInline(text)
    .map((t) => {
      const v = escapeHtml(t.value);
      if (t.type === 'bold') return `<strong>${v}</strong>`;
      if (t.type === 'italic') return `<em>${v}</em>`;
      if (t.type === 'code') return `<code>${v}</code>`;
      if (t.type === 'link') return `<a href="${escapeHtml(t.href)}">${v}</a>`;
      return v;
    })
    .join('');
}

const listHtml = (b) => b.items.map((it) => `<li>${inlineToHtml(it)}</li>`).join('');
const rowHtml = (cells, tag) => `<tr>${cells.map((c) => `<${tag}>${inlineToHtml(c)}</${tag}>`).join('')}</tr>`;

const HTML = {
  heading: (b) => `<h${b.level}>${inlineToHtml(b.text)}</h${b.level}>`,
  paragraph: (b) => `<p>${inlineToHtml(b.text)}</p>`,
  ul: (b) => `<ul>${listHtml(b)}</ul>`,
  ol: (b) => `<ol start="${b.start}">${listHtml(b)}</ol>`,
  code: (b) => `<pre><code>${escapeHtml(b.text)}</code></pre>`,
  quote: (b) => `<blockquote>${inlineToHtml(b.text)}</blockquote>`,
  hr: () => '<hr/>',
  table: (b) => `<table><thead>${rowHtml(b.header, 'th')}</thead><tbody>${b.rows.map((r) => rowHtml(r, 'td')).join('')}</tbody></table>`
};

/** Escaped HTML for a print/PDF document. Never passes input HTML through. */
export function blocksToHtml(blocks) {
  return blocks.map((b) => (HTML[b.type] ? HTML[b.type](b) : '')).join('\n');
}

const stripInline = (s) =>
  parseInline(s)
    .map((t) => (t.type === 'link' ? `${t.value} (${t.href})` : t.value))
    .join('');

const PLAIN = {
  ul: (b) => b.items.map((it) => `• ${stripInline(it)}`).join('\n'),
  ol: (b) => b.items.map((it, n) => `${b.start + n}. ${stripInline(it)}`).join('\n'),
  code: (b) => b.text,
  hr: () => '',
  table: (b) => [b.header, ...b.rows].map((r) => r.map(stripInline).join('\t')).join('\n')
};

/** Plain text with markdown markers stripped — used for "Copy section". */
export function blockToPlainText(block) {
  return PLAIN[block.type] ? PLAIN[block.type](block) : stripInline(block.text);
}

/**
 * Group blocks into sections, each starting at a heading. Content before the first
 * heading forms an untitled leading section.
 */
export function splitSections(blocks) {
  const sections = [];
  let current = null;
  for (const b of blocks) {
    if (b.type === 'heading' && b.level <= 2) {
      current = { title: b.text, blocks: [b] };
      sections.push(current);
    } else {
      if (!current) {
        current = { title: null, blocks: [] };
        sections.push(current);
      }
      current.blocks.push(b);
    }
  }
  return sections;
}
