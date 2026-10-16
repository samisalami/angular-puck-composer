import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root (scripts/puck/ → ../..). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Prints per-block diagnostics. Returns the number of errors.
 * quiet: only blocks with errors are listed (used by generate).
 */
export function printDiagnostics(blocks, { quiet = false } = {}) {
  let errors = 0;
  for (const block of blocks) {
    const errs = block.diagnostics.filter((d) => d.level === 'error');
    const warns = block.diagnostics.filter((d) => d.level === 'warning');
    errors += errs.length;
    if (quiet && errs.length === 0) continue;
    const mark = errs.length ? '✗' : warns.length ? '⚠' : '✓';
    const where = block.component ? `${block.component} → <${block.tag}>` : block.storyFile;
    console.log(`${mark} ${block.name.padEnd(14)} ${where}`);
    for (const d of errs) console.log(`    ✗ ${d.message}`);
    if (!quiet) for (const d of warns) console.log(`    ⚠ ${d.message}`);
  }
  return errors;
}
