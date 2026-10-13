import { useMemo } from 'react';
import PropTypes from 'prop-types';
import DOMPurify from 'dompurify';

/***************************  CONTENT - INNER HTML  ***************************/

// Blog content is rich text (HTML from the editor), so it cannot be rendered as plain text.
// Every string is sanitized with DOMPurify before it reaches the DOM: scripts, event-handler
// attributes, javascript: URLs, iframes, forms and other active content are stripped.
const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  FORBID_ATTR: ['style']
};

export function sanitizeHtml(htmlString) {
  if (typeof htmlString !== 'string' || htmlString.length === 0) return '';
  return DOMPurify.sanitize(htmlString, SANITIZE_OPTIONS);
}

function HtmlRenderer({ htmlString }) {
  const safeHtml = useMemo(() => sanitizeHtml(htmlString), [htmlString]);

  return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

export default HtmlRenderer;

HtmlRenderer.propTypes = { htmlString: PropTypes.string };
