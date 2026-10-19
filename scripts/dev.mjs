#!/usr/bin/env node
// `npm run dev`: runs every `dev:*` script from package.json in parallel (npm can't do that itself).
// npm is started through node, not a shell, so this works the same in PowerShell, cmd and POSIX shells.
// When one script exits, or on Ctrl+C, all of them are stopped, including what npm started (ng, vite).

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npmCli = process.env.npm_execpath; // set by npm for the scripts it runs
if (!npmCli) {
  console.error('✗ start this through npm: npm run dev');
  process.exit(1);
}

const { scripts } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const names = Object.keys(scripts).filter((name) => name.startsWith('dev:'));
console.log(`starting ${names.join(', ')}`);

// POSIX: own process group per script, so stop() reaches the whole tree (npm doesn't pass SIGTERM on).
// Windows: no `detached` (it would open a new console window); taskkill /T handles the tree.
const children = names.map((name) =>
  spawn(process.execPath, [npmCli, 'run', name], { cwd: root, stdio: 'inherit', detached: !isWindows }),
);

let stopping = false;
for (const [i, child] of children.entries()) {
  child.on('exit', (code) => {
    if (!stopping) console.log(`${names[i]} exited (${code ?? 'signal'}), stopping the others`);
    stopAll(code ?? 1);
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stopAll(0));

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  process.exitCode = exitCode;
}
