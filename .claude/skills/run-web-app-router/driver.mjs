#!/usr/bin/env node
// Driver for the MarketingTool web app.
//
// Starts the Vite dev server if it is not already up, then drives the running
// page over the Chrome DevTools Protocol: navigate, read text, click by label,
// fill inputs, screenshot. No Playwright, no extra install -- it speaks CDP
// over a WebSocket to a Chrome you already have.
//
// Usage:
//   node .claude/skills/run-web-app-router/driver.mjs smoke
//   node .claude/skills/run-web-app-router/driver.mjs shot /login out.png
//   node .claude/skills/run-web-app-router/driver.mjs text /login
//   node .claude/skills/run-web-app-router/driver.mjs click /login "Sign in with Google"
//
// Env:
//   PORT=5173        dev server port (must be a port Appwrite accepts, see SKILL.md)
//   CDP=9222         Chrome remote-debugging port
//   HOST=localhost   NEVER 127.0.0.1 -- Appwrite rejects that origin

import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";

const PORT = process.env.PORT || "5173";
const CDP = process.env.CDP || "9222";
const HOST = process.env.HOST || "localhost";
const BASE = `http://${HOST}:${PORT}`;

const log = (...a) => console.log("[driver]", ...a);

async function httpJson(url) {
  const r = await fetch(url);
  return r.json();
}

async function serverUp() {
  try {
    const r = await fetch(BASE + "/", { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return log(`dev server already up at ${BASE}`);
  log(`starting vite on :${PORT} ...`);
  const p = spawn("node_modules/.bin/vite", ["dev", "--port", PORT, "--strictPort"], {
    stdio: "ignore",
    detached: true,
  });
  p.unref();
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (await serverUp()) return log(`dev server up at ${BASE} after ${i + 1}s`);
  }
  throw new Error(`vite did not come up on :${PORT} in 60s`);
}

// --- CDP -------------------------------------------------------------------

async function cdpTarget() {
  const list = await httpJson(`http://127.0.0.1:${CDP}/json/list`);
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("no CDP page target; is Chrome running with --remote-debugging-port?");
  return page;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => reject(new Error(`${method} timed out`)), 60000);
    });
  }
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + expr.slice(0, 120));
    return r.result.value;
  }
  close() {
    this.ws.close();
  }
}

async function connect() {
  const t = await cdpTarget();
  const ws = new globalThis.WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  return new Cdp(ws);
}

async function goto(cdp, path) {
  const url = path.startsWith("http") ? path : BASE + path;
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url });
  // Wait for React to paint something, not just for the document.
  for (let i = 0; i < 45; i++) {
    await sleep(1000);
    const ready = await cdp.eval(
      `(document.readyState === 'complete') && (document.body?.innerText || '').trim().length > 0`,
    );
    if (ready) return;
  }
  throw new Error(`page did not render: ${url}`);
}

const pageText = (cdp) => cdp.eval(`document.body.innerText.slice(0, 4000)`);

async function clickLabel(cdp, label) {
  const box = await cdp.eval(`
    (() => {
      const want = ${JSON.stringify(label)}.toLowerCase();
      const el = [...document.querySelectorAll('button,a,[role="button"]')]
        .find(x => (x.innerText || '').trim().toLowerCase().includes(want)
                   && x.getBoundingClientRect().width > 0);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    })()
  `);
  if (!box) throw new Error(`no visible clickable element matching: ${label}`);
  // A plain .click() is unreliable on MUI; synthesise real mouse events.
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: type === "mouseMoved" ? "none" : "left",
      buttons: type === "mousePressed" ? 1 : 0,
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
    await sleep(120);
  }
  return box;
}

async function fill(cdp, selector, value) {
  const ok = await cdp.eval(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      el.focus(); set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  if (!ok) throw new Error(`no input matching ${selector}`);
}

async function shot(cdp, out) {
  const r = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(r.data, "base64"));
  return out;
}

// --- commands ---------------------------------------------------------------

const ROUTES = ["/login", "/register", "/dashboard/analytics", "/tools", "/chat"];

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  await ensureServer();
  const cdp = await connect();
  try {
    if (cmd === "smoke") {
      let bad = 0;
      for (const r of ROUTES) {
        try {
          await goto(cdp, r);
          const t = (await pageText(cdp)).replace(/\s+/g, " ").slice(0, 90);
          console.log(`  OK   ${r.padEnd(24)} ${t}`);
        } catch (e) {
          bad++;
          console.log(`  FAIL ${r.padEnd(24)} ${e.message}`);
        }
      }
      console.log(bad ? `\n${bad} route(s) failed` : "\nall routes rendered");
      process.exitCode = bad ? 1 : 0;
    } else if (cmd === "text") {
      await goto(cdp, a || "/login");
      console.log(await pageText(cdp));
    } else if (cmd === "shot") {
      await goto(cdp, a || "/login");
      console.log("saved", await shot(cdp, b || "shot.png"));
    } else if (cmd === "click") {
      await goto(cdp, a);
      console.log("clicked at", await clickLabel(cdp, b));
      await sleep(4000);
      console.log("url now:", await cdp.eval("location.href"));
    } else {
      console.log("commands: smoke | text <route> | shot <route> <file> | click <route> <label>");
    }
  } finally {
    cdp.close();
  }
}

main().catch((e) => {
  console.error("[driver] " + e.message);
  process.exit(1);
});
