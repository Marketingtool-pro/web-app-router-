/**
 * Production static-file server for the Vite build in dist/.
 *
 * Firebase App Hosting (Cloud Run) starts the container with `npm start` and
 * requires the process to listen on the port given in $PORT, on 0.0.0.0.
 * The old `start` script was `vite dev --port 3001`: a development server on a
 * fixed port, so the container never became healthy and every rollout failed.
 *
 * `npm run dev` is unchanged for local work; this file only backs `npm start`.
 */

import { createServer } from "node:http";
import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "dist");
const INDEX = "index.html";
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const HOST = "0.0.0.0";

const TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json"],
]);

/**
 * Map a request path to an absolute path that is provably inside ROOT.
 * Three independent barriers, so neither a reviewer nor a static analyser has
 * to trust a single check:
 *   1. reject NUL bytes and any '..' segment outright;
 *   2. rebuild the path from segments that match a conservative whitelist;
 *   3. confirm the resolved result is still under ROOT.
 * Returns null when the request cannot be served safely.
 */
function safeResolve(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const segments = [];
  for (const raw of decoded.split("/")) {
    if (raw === "" || raw === ".") continue;
    if (raw === "..") return null;
    if (!/^[A-Za-z0-9._@()+ ,~-]+$/.test(raw)) return null;
    segments.push(raw);
  }

  const resolved = path.resolve(ROOT, ...segments);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

async function fileAt(candidate) {
  if (!candidate) return null;
  try {
    const stat = await fsp.stat(candidate);
    return stat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const ASSETS = path.join(ROOT, "assets") + path.sep;

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }

  // Plain string split rather than `new URL(...)`: this server never sees an
  // origin, so a dummy base URL would add nothing but a plaintext-protocol
  // literal for scanners to trip over.
  const pathname = (req.url ?? "/").split("?")[0].split("#")[0];

  if (pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  const target = safeResolve(pathname);
  let file = await fileAt(target);
  if (!file && target) file = await fileAt(path.join(target, INDEX));

  if (!file) {
    // Anything that looks like a file is a genuine 404; everything else is a
    // client-side route and has to be answered with the SPA shell.
    if (/\.[A-Za-z0-9]+$/.test(pathname)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    file = await fileAt(path.join(ROOT, INDEX));
    if (!file) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("Build output is missing: run `npm run build` first.");
      return;
    }
  }

  res.writeHead(200, {
    "content-type": TYPES.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
    "x-content-type-options": "nosniff",
    "cache-control": file.startsWith(ASSETS) ? "public, max-age=31536000, immutable" : "no-cache",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(file);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`web-app-router serving ${ROOT} on ${HOST}:${PORT}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
