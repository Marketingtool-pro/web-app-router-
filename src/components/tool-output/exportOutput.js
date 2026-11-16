/***************************  TOOL OUTPUT - EXPORT HELPERS  ***************************/

import { blocksToHtml, parseInline, parseMarkdown } from './markdown';

/** A filesystem-safe base name, e.g. "Ad Copy Generator!" -> "ad-copy-generator". */
export function safeFileName(name, fallback = 'result') {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || fallback;
}

export async function copyText(text) {
  if (!navigator?.clipboard?.writeText) throw new Error('Clipboard is not available in this browser.');
  await navigator.clipboard.writeText(text);
}

function saveBlob(blob, fullName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fullName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadTxt(text, fileName) {
  saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safeFileName(fileName)}.txt`);
}

/***************************  TABLES → CSV  ***************************/

const cellText = (cell) =>
  parseInline(String(cell ?? ''))
    .map((t) => t.value)
    .join('')
    .trim();

/** Every markdown table in the output, as { header: string[], rows: string[][] } with inline formatting removed. */
export function tablesFromMarkdown(markdown) {
  return parseMarkdown(String(markdown || ''))
    .filter((b) => b.type === 'table')
    .map((b) => ({ header: b.header.map(cellText), rows: b.rows.map((r) => r.map(cellText)) }));
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV. Several tables are separated by one blank line. */
export function tablesToCsv(tables) {
  return tables.map((t) => [t.header, ...t.rows].map((r) => r.map(csvCell).join(',')).join('\r\n')).join('\r\n\r\n');
}

export function downloadCsv(markdown, fileName) {
  const tables = tablesFromMarkdown(markdown);
  if (!tables.length) throw new Error('This result has no table to export.');
  // BOM so Excel opens UTF-8 correctly.
  saveBlob(new Blob(['﻿' + tablesToCsv(tables)], { type: 'text/csv;charset=utf-8' }), `${safeFileName(fileName)}.csv`);
}

/***************************  IMAGES / VIDEO  ***************************/

const DATA_IMAGE = /data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/g;
const HTTP_IMAGE = /https?:\/\/[^\s)"'<>]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s)"'<>]*)?(?=[\s)"'<>]|$)/gi;
const HTTP_VIDEO = /https?:\/\/[^\s)"'<>]+?\.(?:mp4|webm|mov)(?:\?[^\s)"'<>]*)?(?=[\s)"'<>]|$)/gi;

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/** Images and videos the AI Router returned inside the text (data: URLs or https links). */
export function extractMedia(text) {
  const s = String(text || '');
  return {
    images: uniq([...(s.match(DATA_IMAGE) || []), ...(s.match(HTTP_IMAGE) || [])]),
    videos: uniq(s.match(HTTP_VIDEO) || [])
  };
}

function extFor(url, blobType, fallback) {
  const fromType = (blobType || '').split('/')[1];
  if (fromType && /^[a-z0-9]+$/.test(fromType)) return fromType === 'jpeg' ? 'jpg' : fromType;
  const m = String(url).match(/^data:\w+\/(\w+)|\.(\w{3,4})(?:\?|$)/);
  return (m && (m[1] || m[2])) || fallback;
}

/**
 * Download an image or video. data: URLs and CORS-enabled hosts are saved as a file;
 * if the host blocks cross-origin reads, the file opens in a new tab instead so the
 * customer can still save it.
 */
export async function downloadMedia(url, fileName, fallbackExt = 'bin') {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    saveBlob(blob, `${safeFileName(fileName)}.${extFor(url, blob.type, fallbackExt)}`);
  } catch {
    if (String(url).startsWith('data:')) throw new Error('This file could not be saved.');
    window.open(url, '_blank', 'noopener');
  }
}

/** Download several files one after another, numbered. */
export async function downloadAllMedia(urls, fileName, fallbackExt) {
  for (let i = 0; i < urls.length; i += 1) {
    await downloadMedia(urls[i], urls.length > 1 ? `${fileName}-${i + 1}` : fileName, fallbackExt);
  }
}

// Print stylesheet for paper. Colours are the app's own light-mode text and divider
// tokens (src/themes/palette.js) — no new colours are introduced.
const PRINT_CSS = `
  @page { margin: 18mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1B1B1F; font-size: 12pt; line-height: 1.6; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.2em 0 .4em; break-after: avoid; }
  h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; } h4 { font-size: 12pt; }
  p, li { color: #46464F; }
  pre { white-space: pre-wrap; border: 1px solid #EFEDF4; padding: 10px; border-radius: 6px; break-inside: avoid; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: .92em; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; break-inside: avoid; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #EFEDF4; }
  blockquote { margin: 1em 0; padding-left: 12px; border-left: 3px solid #EFEDF4; font-style: italic; }
  hr { border: 0; border-top: 1px solid #EFEDF4; }
  a { color: inherit; }
  .doc-title { font-size: 10pt; color: #46464F; margin-bottom: 1.5em; }
`;

/** Build the standalone, fully escaped HTML document used for PDF export. */
export function buildPrintDocument(markdown, title = 'Result') {
  const esc = String(title).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title><style>${PRINT_CSS}</style></head><body><div class="doc-title">${esc}</div>${blocksToHtml(parseMarkdown(markdown))}</body></html>`;
}

/**
 * Open the browser's print dialog for the output ("Save as PDF").
 * Uses a hidden iframe so pop-up blockers never interfere and the app page itself
 * is not reflowed. No html2canvas: no cross-origin assets are captured.
 */
export function printAsPdf(markdown, title) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('Could not prepare the PDF.');
      doc.open();
      doc.write(buildPrintDocument(markdown, title));
      doc.close();
      const win = iframe.contentWindow;
      win.focus();
      win.print();
      cleanup();
      resolve();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}
