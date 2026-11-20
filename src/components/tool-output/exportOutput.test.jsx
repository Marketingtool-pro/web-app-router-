import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import OutputToolbar from './OutputToolbar';
import { extractMedia, tablesFromMarkdown, tablesToCsv } from './exportOutput';

const TABLE_MD = `## Spend

| Campaign | Spend | CTR |
|---|---|---|
| **Spring, sale** | $1,200 | 2.1% |
| Brand "core" | $800 | 1.4% |
`;

describe('tables → CSV', () => {
  it('reads markdown tables and strips inline formatting', () => {
    const tables = tablesFromMarkdown(TABLE_MD);
    expect(tables).toHaveLength(1);
    expect(tables[0].header).toEqual(['Campaign', 'Spend', 'CTR']);
    expect(tables[0].rows[0]).toEqual(['Spring, sale', '$1,200', '2.1%']);
  });

  it('quotes commas and quotes per RFC 4180', () => {
    const csv = tablesToCsv(tablesFromMarkdown(TABLE_MD));
    expect(csv.split('\r\n')).toEqual(['Campaign,Spend,CTR', '"Spring, sale","$1,200",2.1%', '"Brand ""core""",$800,1.4%']);
  });

  it('returns no tables for plain text', () => {
    expect(tablesFromMarkdown('just text')).toEqual([]);
  });
});

describe('extractMedia', () => {
  it('finds router data: images, https images and mp4 links, without duplicates', () => {
    const text = [
      'Image: data:image/png;base64,iVBORw0KGgo=',
      '![ad](https://app.marketingtool.pro/images/ad-1.png)',
      'again https://app.marketingtool.pro/images/ad-1.png',
      'Video: https://v3.fal.media/files/abc/output.mp4?x=1'
    ].join('\n');
    const media = extractMedia(text);
    expect(media.images).toEqual(['data:image/png;base64,iVBORw0KGgo=', 'https://app.marketingtool.pro/images/ad-1.png']);
    expect(media.videos).toEqual(['https://v3.fal.media/files/abc/output.mp4?x=1']);
  });

  it('finds nothing in plain text', () => {
    expect(extractMedia('no media here')).toEqual({ images: [], videos: [] });
  });
});

describe('OutputToolbar media actions', () => {
  it('shows CSV only when the result has a table', () => {
    const { rerender } = render(<OutputToolbar output="plain text" title="T" />);
    expect(screen.queryByRole('button', { name: /tables \(\.csv\)/i })).toBeNull();
    rerender(<OutputToolbar output={TABLE_MD} title="T" />);
    expect(screen.getByRole('button', { name: /tables \(\.csv\)/i })).toBeTruthy();
  });

  it('shows image and video buttons for media in the text or passed by the page', () => {
    render(<OutputToolbar output="Done" title="T" images={['data:image/png;base64,AAAA']} videos={['https://x.test/v.mp4']} />);
    expect(screen.getByRole('button', { name: /download image/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /download video/i })).toBeTruthy();
  });

  it('shows no media buttons before there is output', () => {
    render(<OutputToolbar output="" title="T" images={['data:image/png;base64,AAAA']} />);
    expect(screen.queryByRole('button', { name: /download image/i })).toBeNull();
  });
});
