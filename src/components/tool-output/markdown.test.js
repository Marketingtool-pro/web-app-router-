import { describe, expect, it } from 'vitest';
import { blockToPlainText, blocksToHtml, isSafeUrl, parseInline, parseMarkdown, splitSections } from './markdown';
import { buildPrintDocument, safeFileName } from './exportOutput';

describe('parseMarkdown', () => {
  it('parses headings H1–H4 and clamps H5/H6 to H4', () => {
    const blocks = parseMarkdown('# One\n## Two\n### Three\n#### Four\n##### Five');
    expect(blocks.map((b) => [b.type, b.level])).toEqual([
      ['heading', 1],
      ['heading', 2],
      ['heading', 3],
      ['heading', 4],
      ['heading', 4]
    ]);
  });

  it('parses bullet and numbered lists, keeping the start number', () => {
    const blocks = parseMarkdown('- a\n* b\n+ c\n\n3. x\n4) y');
    expect(blocks[0]).toEqual({ type: 'ul', items: ['a', 'b', 'c'] });
    expect(blocks[1]).toEqual({ type: 'ol', start: 3, items: ['x', 'y'] });
  });

  it('keeps fenced code verbatim, including markdown inside it', () => {
    const blocks = parseMarkdown('```js\nconst a = 1;\n# not a heading\n```');
    expect(blocks).toEqual([{ type: 'code', lang: 'js', text: 'const a = 1;\n# not a heading' }]);
  });

  it('closes an unterminated code fence at end of input', () => {
    expect(parseMarkdown('```\nline')).toEqual([{ type: 'code', lang: '', text: 'line' }]);
  });

  it('parses pipe tables with header and rows', () => {
    const blocks = parseMarkdown('| KPI | Value |\n|---|---:|\n| CTR | 2.1% |\n| CPC | $0.40 |');
    expect(blocks).toEqual([{ type: 'table', header: ['KPI', 'Value'], rows: [['CTR', '2.1%'], ['CPC', '$0.40']] }]);
  });

  it('joins soft-wrapped lines into one paragraph and splits on blank lines', () => {
    const blocks = parseMarkdown('first line\nsecond line\n\nnext para');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'first line second line' },
      { type: 'paragraph', text: 'next para' }
    ]);
  });

  it('parses quotes and rules', () => {
    expect(parseMarkdown('> quoted\n---').map((b) => b.type)).toEqual(['quote', 'hr']);
  });

  it('renders a JSON payload as a single json code block', () => {
    const json = JSON.stringify({ headline: 'Hi', items: [1, 2] }, null, 2);
    expect(parseMarkdown(json)).toEqual([{ type: 'code', lang: 'json', text: json }]);
  });

  it('handles empty and nullish input', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(null)).toEqual([]);
  });
});

describe('parseInline', () => {
  it('tokenizes bold, italic, code and links', () => {
    expect(parseInline('a **b** *c* `d` [e](https://x.com)')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'b' },
      { type: 'text', value: ' ' },
      { type: 'italic', value: 'c' },
      { type: 'text', value: ' ' },
      { type: 'code', value: 'd' },
      { type: 'text', value: ' ' },
      { type: 'link', value: 'e', href: 'https://x.com' }
    ]);
  });

  it('drops unsafe link targets to plain text', () => {
    for (const src of ['[click](javascript:alert)', '[click](data:text/html,x)', '[click](javascript:alert(1))']) {
      expect(parseInline(src).some((t) => t.type === 'link')).toBe(false);
    }
  });

  it('leaves snake_case identifiers alone', () => {
    expect(parseInline('use utm_source_name and __init__x')).toEqual([{ type: 'text', value: 'use utm_source_name and __init__x' }]);
    expect(parseInline('an _emphasis_ word')[1]).toEqual({ type: 'italic', value: 'emphasis' });
  });

  it('does not treat a lone asterisk in maths as italic', () => {
    expect(parseInline('2 * 3 = 6').every((t) => t.type === 'text')).toBe(true);
  });
});

describe('safety and export', () => {
  it('accepts only http(s) and mailto URLs', () => {
    expect(isSafeUrl('https://a.b')).toBe(true);
    expect(isSafeUrl('mailto:x@y.z')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,hi')).toBe(false);
  });

  it('escapes any HTML in the output when building the print document', () => {
    const html = blocksToHtml(parseMarkdown('# <img src=x onerror=alert(1)>\n<script>bad()</script>'));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the document title', () => {
    expect(buildPrintDocument('hi', '</title><script>x</script>')).not.toContain('<script>x');
  });

  it('builds safe file names', () => {
    expect(safeFileName('Ad Copy Generator!')).toBe('ad-copy-generator');
    expect(safeFileName('')).toBe('result');
  });
});

describe('sections', () => {
  it('splits on H1/H2 and gives plain text for copy-section', () => {
    const sections = splitSections(parseMarkdown('intro\n## Headlines\n- **A**\n- B\n## CTA\nBuy now'));
    expect(sections.map((s) => s.title)).toEqual([null, 'Headlines', 'CTA']);
    expect(sections[1].blocks.map(blockToPlainText).join('\n')).toBe('Headlines\n• A\n• B');
  });
});
