import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HtmlRenderer, { sanitizeHtml } from './HtmlRenderer';

describe('HtmlRenderer', () => {
  it('keeps ordinary rich-text formatting', () => {
    const { container } = render(
      <HtmlRenderer htmlString={'<h2>Heading</h2><p><strong>bold</strong> <a href="https://marketingtool.pro">link</a></p>'} />
    );
    expect(container.querySelector('h2')).toHaveTextContent('Heading');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://marketingtool.pro');
  });

  it('strips scripts, event handlers and javascript: URLs', () => {
    const payload =
      '<img src="x" onerror="window.__xss=1"><script>window.__xss=2</script>' +
      '<a href="javascript:window.__xss=3">click</a><iframe src="https://evil.example"></iframe>' +
      '<svg><animate onbegin="window.__xss=4"></animate></svg>';
    const { container } = render(<HtmlRenderer htmlString={payload} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.querySelector('[onbegin]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
    expect(window.__xss).toBeUndefined();
  });

  it('drops forms and inline styles', () => {
    const html = sanitizeHtml('<form action="https://evil.example"><input name="p"></form><p style="position:fixed">x</p>');
    expect(html).not.toMatch(/<form|<input|style=/i);
    expect(html).toContain('<p>x</p>');
  });

  it('returns an empty string for missing or non-string input', () => {
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(42)).toBe('');
  });
});
