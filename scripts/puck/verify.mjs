#!/usr/bin/env node
// Verifies that components + stories can be turned into Puck blocks, that the generated files are
// up to date, and that no change breaks pages that are already saved.
//
//   node scripts/puck/verify.mjs                  all stories tagged `puck`
//   node scripts/puck/verify.mjs Quote Card       only these blocks (block type or component class)
//   node scripts/puck/verify.mjs --base origin/main   compare the schema against another git ref (default: HEAD)
//   node scripts/puck/verify.mjs --allow-breaking     report breaking changes as warnings instead of errors
//
// Exit code 1 if anything is wrong.

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyze } from './analyze.mjs';
import { config } from './config.mjs';
import { manifest, renderFiles } from './render.mjs';
import { printDiagnostics, ROOT } from './shared.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const base = option('--base') ?? 'HEAD';
const allowBreaking = flag('--allow-breaking');
const filters = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base').map((f) => f.toLowerCase());

const { blocks, skipped } = analyze(ROOT);
const selected = filters.length
  ? blocks.filter((b) => filters.includes(b.name.toLowerCase()) || filters.includes(b.component.toLowerCase()))
  : blocks;

let errors = 0;

// 1. Per component -------------------------------------------------------------------------------
console.log('Components');
if (filters.length && selected.length < filters.length) {
  const found = new Set(selected.flatMap((b) => [b.name.toLowerCase(), b.component.toLowerCase()]));
  for (const f of filters.filter((f) => !found.has(f))) {
    console.log(`✗ ${f}: no story tagged '${config.tag}' for this block/component`);
    errors++;
  }
}
errors += printDiagnostics(selected);
if (!filters.length && skipped.length) {
  console.log(`\n  not in Puck (no '${config.tag}' tag): ${skipped.map((s) => s.split('/').pop()).join(', ')}`);
}

// Stop here if analysis failed: the remaining checks need a valid model.
if (blocks.some((b) => b.diagnostics.some((d) => d.level === 'error'))) {
  if (filters.length && errors === 0) console.log('\n(other blocks have errors - run without arguments to see them)');
  finish();
}

// 2. Generated files up to date --------------------------------------------------------------------
console.log('\nGenerated files');
const files = await renderFiles(ROOT, blocks);
const stale = [];
for (const [path, content] of Object.entries(files)) {
  const current = await readFile(resolve(ROOT, path), 'utf8').catch(() => null);
  if (current !== content) stale.push(path);
}
if (stale.length) {
  errors++;
  console.log(`✗ out of date: ${stale.join(', ')}\n    run: pnpm puck:generate`);
} else console.log('✓ up to date');

// 3. Breaking changes for saved pages ----------------------------------------------------------------
console.log(`\nSaved-page compatibility (vs ${base})`);
const previous = readManifestAt(base);
if (!previous) {
  console.log(`  - no ${config.out.manifest} at ${base}, skipped`);
} else {
  const breaking = diffManifests(previous, manifest(blocks));
  if (breaking.length === 0) console.log('✓ no breaking changes');
  for (const message of breaking) {
    console.log(`${allowBreaking ? '⚠' : '✗'} ${message}`);
    if (!allowBreaking) errors++;
  }
  if (breaking.length && !allowBreaking) {
    console.log('    Saved pages still use the old names/values. Migrate the page JSON (or map it in');
    console.log("    Puck's resolveData), then re-run with --allow-breaking to acknowledge.");
  }
}

finish();

function finish() {
  console.log(errors ? `\n✗ ${errors} problem(s)` : '\n✓ all checks passed');
  process.exit(errors ? 1 : 0);
}

function readManifestAt(ref) {
  try {
    const json = execFileSync('git', ['show', `${ref}:${config.out.manifest}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Changes that make previously saved page JSON invalid or render differently. */
function diffManifests(before, after) {
  const out = [];
  for (const [name, old] of Object.entries(before.blocks ?? {})) {
    const now = after.blocks[name];
    if (!now) {
      out.push(`block "${name}" was removed or renamed`);
      continue;
    }
    if (old.slot && !now.slot) out.push(`${name}: slot "${old.slot}" was removed (nested blocks would be lost)`);
    for (const [prop, oldProp] of Object.entries(old.props ?? {})) {
      const nowProp = now.props[prop];
      if (!nowProp) {
        out.push(`${name}.${prop} was removed or renamed`);
        continue;
      }
      if (nowProp.kind !== oldProp.kind) out.push(`${name}.${prop}: type changed ${oldProp.kind} → ${nowProp.kind}`);
      const gone = (oldProp.options ?? []).filter((o) => !(nowProp.options ?? []).includes(o));
      if (gone.length) out.push(`${name}.${prop}: option(s) ${gone.map((o) => JSON.stringify(o)).join(', ')} removed`);
    }
  }
  return out;
}
