#!/usr/bin/env node
// Runtime smoke test for the generated blocks: catches what static analysis can't (missing
// providers → NullInjectorError, components that break as custom elements, broken styles).
//
// Needs a built composer:  pnpm build:elements && pnpm build:composer
// Needs Chromium once:     pnpm exec playwright install chromium
//                          (or point CHROMIUM_PATH at an existing Chromium/Chrome binary)
//
//   node scripts/puck/smoke.mjs
//
// Starts server/server.mjs on a free port with a throw-away data dir, saves one page that contains
// every generated block with its default props, then checks in headless Chromium that:
//   - the share view renders every block's custom element with content and without page errors
//   - the editor loads and lists every block in the drawer

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { config } from './config.mjs';
import { ROOT } from './shared.mjs';

const DIST = resolve(ROOT, 'composer/dist');
if (!(await stat(join(DIST, 'elements/main.js')).catch(() => null))) {
  console.error('✗ composer/dist/elements/main.js missing - run: pnpm build:elements && pnpm build:composer');
  process.exit(1);
}

const { blocks } = JSON.parse(await readFile(resolve(ROOT, config.out.manifest), 'utf8'));
const port = await freePort();
const dataDir = await mkdtemp(join(tmpdir(), 'puck-smoke-'));

// One page, every block once (slots empty), using the generated defaults.
const page = {
  root: { props: { title: 'smoke', theme: 'light' } },
  content: Object.entries(blocks).map(([type, block], i) => ({
    type,
    props: {
      id: `${type}-smoke-${i}`,
      ...Object.fromEntries(Object.entries(block.props).map(([name, p]) => [name, p.default])),
      ...(block.slot ? { [block.slot]: [] } : {}),
    },
  })),
};
await writeFile(join(dataDir, 'smoke.json'), JSON.stringify(page));

const server = spawn(process.execPath, [resolve(ROOT, 'server/server.mjs')], {
  env: { ...process.env, PORT: String(port), STATIC_DIR: DIST, DATA_DIR: dataDir },
  stdio: 'ignore',
});

let failed = 0;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  await waitForServer(`http://127.0.0.1:${port}/healthz`);
  const tab = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  tab.on('pageerror', (e) => pageErrors.push(e.message));
  tab.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));

  // Share view: every element rendered by Angular.
  await tab.goto(`http://127.0.0.1:${port}/view/smoke`);
  await tab.waitForFunction(() => Array.isArray(window.apcElements), null, { timeout: 15000 });
  await tab.waitForTimeout(300);
  console.log('Share view');
  for (const [type, block] of Object.entries(blocks)) {
    const result = await tab.evaluate((tag) => {
      const el = document.querySelector(tag);
      if (!el) return 'not rendered';
      if (!customElements.get(tag)) return 'tag not defined by the elements bundle';
      if (el.children.length === 0 && !el.textContent?.trim()) return 'element is empty (component did not render)';
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return 'element has no size';
      return 'ok';
    }, block.tag);
    report(`${type} <${block.tag}>`, result);
  }

  // Editor: loads and lists every block.
  await tab.goto(`http://127.0.0.1:${port}/edit/smoke`);
  await tab.waitForFunction(() => Array.isArray(window.apcElements), null, { timeout: 15000 });
  console.log('Editor');
  for (const [type, block] of Object.entries(blocks)) {
    const inDrawer = await tab.getByText(block.label ?? type, { exact: true }).count();
    report(`${type} in drawer`, inDrawer ? 'ok' : 'missing from the block drawer');
  }

  console.log('Page errors');
  report('no page/console errors', pageErrors.length ? pageErrors.slice(0, 5).join(' | ') : 'ok');
} finally {
  await browser.close();
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}

console.log(failed ? `\n✗ ${failed} problem(s)` : '\n✓ smoke test passed');
process.exit(failed ? 1 : 0);

function report(what, result) {
  if (result === 'ok') console.log(`✓ ${what}`);
  else {
    failed++;
    console.log(`✗ ${what}: ${result}`);
  }
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

async function waitForServer(url) {
  for (let i = 0; i < 50; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start: ${url}`);
}
