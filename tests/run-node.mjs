/* ==========================================================================
   Node test runner. Usage:  node tests/run-node.mjs
   Imports the shared DSP + app test specs (the same files the browser page
   loads) and runs them. Exits non-zero on any failure.
   No dependencies; requires Node 16+ for ES modules + import.meta.
   ========================================================================== */
import './dsp.test.js';
import './app.test.js';
import { run } from './harness.js';

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m';

console.log(BOLD + '\nSMILE Speech Signal Lab — DSP + app regression suite (Node)\n' + RESET);

const summary = await run((r) => {
  const mark = r.ok ? GREEN + '  PASS' : RED + '  FAIL';
  console.log(mark + RESET + ' ' + r.name + DIM + '  (' + r.ms + ' ms)' + RESET);
  if(!r.ok) console.log(RED + '       ' + r.error + RESET);
});

console.log('\n' + BOLD + `${summary.passed}/${summary.total} passed` + RESET +
  (summary.failed ? RED + `, ${summary.failed} failed` + RESET : ''));

process.exit(summary.failed ? 1 : 0);
