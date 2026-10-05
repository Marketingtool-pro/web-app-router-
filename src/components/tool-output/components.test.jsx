import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EmptyState from './EmptyState';
import MarkdownRenderer from './MarkdownRenderer';
import OutputToolbar from './OutputToolbar';

const status = (id) => document.querySelector(`[data-action="${id}"]`)?.getAttribute('data-status');

describe('MarkdownRenderer', () => {
  it('renders headings, lists, code and safe links', () => {
    render(<MarkdownRenderer content={'# Title\n- one\n- **two**\n\n```\ncode()\n```\n[site](https://marketingtool.pro) [bad](javascript:x)'} />);
    expect(screen.getByRole('heading', { name: /Title/ })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('code()')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'site' });
    expect(link).toHaveAttribute('href', 'https://marketingtool.pro');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
  });

  it('never renders HTML from the output', () => {
    const { container } = render(<MarkdownRenderer content={'<img src=x onerror="window.__x=1"> <b>hi</b>'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(/<b>hi<\/b>/)).toBeInTheDocument();
  });

  it('auto-collapses large outputs and expands on demand', () => {
    const big = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} ${'x'.repeat(200)}`).join('\n\n');
    render(<MarkdownRenderer content={big} collapseAt={1000} collapsedBlocks={5} />);
    expect(screen.queryByText(/Paragraph 39/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show full result/ }));
    expect(screen.getByText(/Paragraph 39/)).toBeInTheDocument();
  });

  it('collapses a single huge block by characters, not just block count', () => {
    const json = JSON.stringify({ rows: Array.from({ length: 400 }, (_, i) => ({ id: i, label: `row-${i}` })) }, null, 2);
    const { container } = render(<MarkdownRenderer content={json} collapseAt={1000} />);
    expect(container.textContent.length).toBeLessThan(1200);
    fireEvent.click(screen.getByRole('button', { name: /Show full result/ }));
    expect(container.textContent).toContain('row-399');
  });

  it('offers download instead of rendering a huge output', () => {
    const onDownload = vi.fn();
    render(<MarkdownRenderer content={'y'.repeat(2000)} maxRenderChars={1000} collapseAt={100} onDownload={onDownload} />);
    expect(screen.getByText(/too large to show in full/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Download full result/ }));
    expect(onDownload).toHaveBeenCalledOnce();
  });
});

describe('OutputToolbar', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.useRealTimers());

  it('disables every action until output exists', () => {
    render(<OutputToolbar output="" onSave={vi.fn()} onRegenerate={vi.fn()} onShare={vi.fn()} onRate={vi.fn()} onLaunch={vi.fn()} />);
    for (const btn of screen.getAllByRole('button')) expect(btn).toBeDisabled();
  });

  it('hides backend actions when no handler is given', () => {
    render(<OutputToolbar output="hello" />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Launch' })).toBeNull();
  });

  it('copies the original markdown and shows success, then resets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<OutputToolbar output="**raw** md" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(status('copy')).toBe('success'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('**raw** md');
    await act(async () => vi.advanceTimersByTime(2100));
    expect(status('copy')).toBe('idle');
  });

  it('shows an error state when an action fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('permission denied'));
    render(<OutputToolbar output="x" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(status('save')).toBe('error'));
  });

  it('copies the share link returned by onShare', async () => {
    const onShare = vi.fn().mockResolvedValue('https://app.marketingtool.pro/share/abc');
    render(<OutputToolbar output="x" onShare={onShare} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    await waitFor(() => expect(status('share')).toBe('success'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app.marketingtool.pro/share/abc');
  });

  it('reports an error when onShare returns no link', async () => {
    render(<OutputToolbar output="x" onShare={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    await waitFor(() => expect(status('share')).toBe('error'));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('passes the thumb value to onRate', async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    render(<OutputToolbar output="x" onRate={onRate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Poor result' }));
    await waitFor(() => expect(onRate).toHaveBeenCalledWith({ thumb: 'down' }));
  });

  it('downloads a .txt file', async () => {
    const createUrl = vi.fn(() => 'blob:x');
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = vi.fn();
    render(<OutputToolbar output="text body" fileName="ad-copy" />);
    fireEvent.click(screen.getByRole('button', { name: 'Download .txt' }));
    await waitFor(() => expect(status('txt')).toBe('success'));
    expect(createUrl).toHaveBeenCalledOnce();
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Tool not found" description="Gone" actionLabel="Back" onAction={onAction} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tool not found');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
