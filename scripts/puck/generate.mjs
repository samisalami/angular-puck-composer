#!/usr/bin/env node
// Generates steps ③–⑤ (custom element registry, JSX typings, Puck blocks) from the stories tagged
// `puck`. Always regenerates everything.
//
//   node scripts/puck/generate.mjs           write the generated files
//   node scripts/puck/generate.mjs --check   fail (exit 1) if the committed files are out of date

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { analyze } from './analyze.mjs';
import { renderFiles } from './render.mjs';
import { printDiagnostics, ROOT } from './shared.mjs';

const check = process.argv.includes('--check');
const { blocks } = analyze(ROOT);

const errorCount = printDiagnostics(blocks, { quiet: true });
if (errorCount > 0) {
  console.error(`\n✗ ${errorCount} error(s) - nothing generated. Details: npm run puck:verify`);
  process.exit(1);
}

const files = await renderFiles(ROOT, blocks);
const stale = [];
for (const [path, content] of Object.entries(files)) {
  const target = resolve(ROOT, path);
  const current = await readFile(target, 'utf8').catch(() => null);
  if (current === content) continue;
  stale.push(path);
  if (!check) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

if (check) {
  if (stale.length) {
    console.error(`✗ generated files are out of date:\n${stale.map((p) => `  - ${p}`).join('\n')}\n  run: npm run puck:generate`);
    process.exit(1);
  }
  console.log(`✓ generated files are up to date (${blocks.length} blocks)`);
} else {
  console.log(`✓ ${blocks.length} blocks: ${blocks.map((b) => b.name).join(', ')}`);
  console.log(stale.length ? `  updated: ${stale.join(', ')}` : '  no changes');
}
