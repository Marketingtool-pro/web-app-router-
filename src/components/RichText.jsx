import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";

/***************************  RICH TEXT (model output)  ***************************/

// The AI Router returns Markdown. It was being dropped into a Typography as
// plain text, so customers saw literal ** around every heading. This renders
// the subset the models actually emit — headings, bold, bullets, paragraphs —
// as React elements. Deliberately not dangerouslySetInnerHTML: this is model
// output and must never be injected as HTML.

function inline(text, keyBase) {
  // Split on **bold** and `code`, keep the delimiters.
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Box key={k} component="strong" sx={{ fontWeight: 600, color: "text.primary" }}>
          {part.slice(2, -2)}
        </Box>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Box
          key={k}
          component="code"
          sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "action.hover", fontSize: "0.85em" }}
        >
          {part.slice(1, -1)}
        </Box>
      );
    }
    return <span key={k}>{part}</span>;
  });
}

export default function RichText({ text }) {
  if (!text) return null;

  const lines = String(text).replace(/\r/g, "").split("\n");
  const blocks = [];
  let bullets = [];

  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <Stack key={`ul-${blocks.length}`} component="ul" sx={{ pl: 2.5, my: 0.5, gap: 0.75 }}>
        {bullets.map((b, i) => (
          <Typography
            key={i}
            component="li"
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.7 }}
          >
            {inline(b, `li-${blocks.length}-${i}`)}
          </Typography>
        ))}
      </Stack>,
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      return;
    }

    const bullet = trimmed.match(/^[-*•]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }

    flush();

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push(
        <Typography key={`h-${idx}`} variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
          {inline(heading[2], `h-${idx}`)}
        </Typography>,
      );
      return;
    }

    // A line that is entirely bold reads as a heading in model output.
    const boldOnly = trimmed.match(/^\*\*(.+?):?\*\*:?$/);
    if (boldOnly) {
      blocks.push(
        <Typography key={`bh-${idx}`} variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
          {boldOnly[1]}
        </Typography>,
      );
      return;
    }

    blocks.push(
      <Typography key={`p-${idx}`} variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
        {inline(trimmed, `p-${idx}`)}
      </Typography>,
    );
  });

  flush();

  return <Stack sx={{ gap: 1 }}>{blocks}</Stack>;
}
