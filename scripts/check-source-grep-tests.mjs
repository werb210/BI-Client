// BI_CLIENT_v789_SOURCE_GREP_BUDGET
// A "source-grep" test reads a file under src/ and asserts on its text
// (expect(read("src/pages/X.tsx")).toContain("...")). Such a test passes when
// the words are present and fails on harmless refactors, so it proves little
// about what the app does. This check counts them and fails when the count
// rises above scripts/source-grep-baseline.json: new tests should exercise
// behaviour instead, and the baseline only ever goes down.
//
//   node scripts/check-source-grep-tests.mjs           check against the baseline
//   node scripts/check-source-grep-tests.mjs --list    also print each file and what it reads
//   node scripts/check-source-grep-tests.mjs --write   set the baseline to the current count
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const baselinePath = join(root, "scripts", "source-grep-baseline.json");
const args = new Set(process.argv.slice(2));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.test\.(ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

// A call that reads file contents, or a Vite ?raw import of a source file.
const READS = /\b(readFileSync|readFile|createReadStream)\s*\(|from\s+["'][^"']+\.(tsx?|css)\?raw["']|import\(\s*["'][^"']+\.(tsx?|css)\?raw["']\s*\)/;
// String literals (single, double or template quoted).
const LITERALS = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
// A literal naming a source file: a path under src/, or a .ts/.tsx/.css file
// (tests live in src/, so a relative .ts/.tsx/.css path is a src/ file).
const SOURCE_PATH = /^(\.{1,2}\/)*src\/|\.(tsx?|css)(\?raw)?$/;

export function sourceReads(text) {
  if (!READS.test(text)) return [];
  const hits = new Set();
  for (const m of text.matchAll(LITERALS)) {
    const value = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!value || /\s/.test(value)) continue; // prose, not a path
    if (/^(@\/|\.\.?\/)?[\w@/.-]+$/.test(value) || /\$\{/.test(value)) {
      if (SOURCE_PATH.test(value)) hits.add(value);
    }
  }
  return [...hits];
}

const files = walk(join(root, "src")).sort();
const offenders = [];
for (const file of files) {
  const reads = sourceReads(readFileSync(file, "utf8"));
  if (reads.length) offenders.push({ file: relative(root, file).split(sep).join("/"), reads });
}

const count = offenders.length;
if (args.has("--list")) {
  for (const o of offenders) console.log(`${o.file}\n    reads: ${o.reads.join(", ")}`);
}
if (args.has("--write")) {
  writeFileSync(baselinePath, JSON.stringify({ maxSourceGrepTests: count, files: offenders.map((o) => o.file) }, null, 2) + "\n");
  console.log(`Baseline set: ${count} source-grep test files.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  console.error(`FAIL: ${relative(root, baselinePath)} is missing or not JSON. Run with --write to create it.`);
  process.exit(1);
}
const max = Number(baseline.maxSourceGrepTests);
if (!Number.isInteger(max) || max < 0) {
  console.error("FAIL: maxSourceGrepTests in the baseline must be a whole number.");
  process.exit(1);
}
if (count > max) {
  const known = new Set(baseline.files ?? []);
  console.error(`FAIL: ${count} test files read src/ to assert on source text; the baseline allows ${max}.`);
  for (const o of offenders.filter((x) => !known.has(x.file))) console.error(`  new: ${o.file} (reads ${o.reads.join(", ")})`);
  console.error("Test what the code does (render it, call it) instead of grepping its text.");
  process.exit(1);
}
console.log(`OK: ${count} source-grep test files (baseline ${max}).${count < max ? " Lower the baseline with --write." : ""}`);
