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
export function parseInline(text) {
  const tokens = [];
  if (!text) return tokens;
  const re = /(`[^`]+`|\*\*[^*]+\*\*|(?<!\w)__[^_]+__(?!\w)|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|(?<!\w)_[^_\s][^_]*_(?!\w))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('`')) {
      tokens.push({ type: 'code', value: tok.slice(1, -1) });
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      tokens.push({ type: 'bold', value: tok.slice(2, -2) });
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (lm && isSafeUrl(lm[2])) tokens.push({ type: 'link', value: lm[1], href: lm[2] });
      else tokens.push({ type: 'text', value: lm ? lm[1] : tok });
    } else {
      tokens.push({ type: 'italic', value: tok.slice(1, -1) });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
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

/**
 * Parse markdown into a flat list of blocks.
 * Block types: heading {level 1-4}, paragraph, ul, ol {start}, code {lang}, quote, hr, table {header, rows}.
 */
export function parseMarkdown(source) {
  const raw = String(source ?? '');
  // Some engines answer with a JSON payload rather than markdown — keep its layout.
  const trimmed = raw.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return [{ type: 'code', lang: 'json', text: trimmed }];
    } catch {
      // not JSON — fall through to markdown
    }
  }
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(RE.fence);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !RE.fence.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or EOF)
      blocks.push({ type: 'code', lang: fence[1] || '', text: code.join('\n') });
      continue;
    }

    const heading = line.match(RE.heading);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 4), text: heading[2] });
      i++;
      continue;
    }

    if (RE.hr.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (RE.tableRow.test(line) && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const header = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && RE.tableRow.test(lines[i])) rows.push(splitRow(lines[i++]));
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (RE.bullet.test(line)) {
      const items = [];
      while (i < lines.length && RE.bullet.test(lines[i])) items.push(lines[i++].match(RE.bullet)[1]);
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (RE.ordered.test(line)) {
      const start = Number(line.match(RE.ordered)[1]) || 1;
      const items = [];
      while (i < lines.length && RE.ordered.test(lines[i])) items.push(lines[i++].match(RE.ordered)[2]);
      blocks.push({ type: 'ol', start, items });
      continue;
    }

    if (RE.quote.test(line)) {
      const quote = [];
      while (i < lines.length && RE.quote.test(lines[i])) quote.push(lines[i++].match(RE.quote)[1]);
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }

    // paragraph: gather until a blank line or the start of another block
    const para = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !RE.fence.test(lines[i]) &&
      !RE.heading.test(lines[i]) &&
      !RE.hr.test(lines[i]) &&
      !RE.bullet.test(lines[i]) &&
      !RE.ordered.test(lines[i]) &&
      !RE.quote.test(lines[i]) &&
      !RE.tableRow.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') });
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

/** Escaped HTML for a print/PDF document. Never passes input HTML through. */
export function blocksToHtml(blocks) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `<h${b.level}>${inlineToHtml(b.text)}</h${b.level}>`;
        case 'paragraph':
          return `<p>${inlineToHtml(b.text)}</p>`;
        case 'ul':
          return `<ul>${b.items.map((it) => `<li>${inlineToHtml(it)}</li>`).join('')}</ul>`;
        case 'ol':
          return `<ol start="${b.start}">${b.items.map((it) => `<li>${inlineToHtml(it)}</li>`).join('')}</ol>`;
        case 'code':
          return `<pre><code>${escapeHtml(b.text)}</code></pre>`;
        case 'quote':
          return `<blockquote>${inlineToHtml(b.text)}</blockquote>`;
        case 'hr':
          return '<hr/>';
        case 'table':
          return `<table><thead><tr>${b.header.map((h) => `<th>${inlineToHtml(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${inlineToHtml(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`;
        default:
          return '';
      }
    })
    .join('\n');
}

/** Plain text with markdown markers stripped — used for "Copy section". */
export function blockToPlainText(block) {
  const strip = (s) =>
    parseInline(s)
      .map((t) => (t.type === 'link' ? `${t.value} (${t.href})` : t.value))
      .join('');
  switch (block.type) {
    case 'ul':
      return block.items.map((it) => `• ${strip(it)}`).join('\n');
    case 'ol':
      return block.items.map((it, n) => `${block.start + n}. ${strip(it)}`).join('\n');
    case 'code':
      return block.text;
    case 'hr':
      return '';
    case 'table':
      return [block.header, ...block.rows].map((r) => r.map(strip).join('\t')).join('\n');
    default:
      return strip(block.text);
  }
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
