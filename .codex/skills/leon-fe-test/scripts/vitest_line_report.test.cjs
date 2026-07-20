'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const reportTool = require('./vitest_line_report.cjs');
const scriptPath = path.join(__dirname, 'vitest_line_report.cjs');

function createWorkspace(testContext) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-line-report-'));
  testContext.after(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  return workspace;
}

function writeFile(workspace, filename, contents) {
  const filePath = path.join(workspace, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function writeJson(workspace, filename, value) {
  return writeFile(workspace, filename, JSON.stringify(value));
}

function runCli(workspace, argumentsList) {
  return spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

function runInMemory(argumentsList, cwd) {
  const stdout = [];
  const stderr = [];
  const status = reportTool.run(argumentsList, {
    cwd,
    log: (message) => stdout.push(message),
    error: (message) => stderr.push(message),
  });
  return { status, stdout, stderr };
}

test('coverage-final uses statement start lines instead of expanding statement ranges', () => {
  const result = reportTool.coverageFromFinal({
    statementMap: {
      0: { start: { line: 1, column: 0 }, end: { line: 2, column: 10 } },
      1: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
    },
    s: { 0: 1, 1: 0 },
  });

  assert.deepEqual(result, { ok: true, percentage: 50 });
});

test('coverage-final rejects nonnumeric statement data', () => {
  const invalidLine = reportTool.coverageFromFinal({
    statementMap: {
      0: { start: { line: '1', column: 0 }, end: { line: 1, column: 10 } },
    },
    s: { 0: 1 },
  });
  const invalidCount = reportTool.coverageFromFinal({
    statementMap: {
      0: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
    },
    s: { 0: true },
  });

  assert.equal(invalidLine.ok, false);
  assert.match(invalidLine.error, /invalid coverage data/u);
  assert.equal(invalidCount.ok, false);
  assert.match(invalidCount.error, /invalid coverage data/u);
});

test('coverage-final validates its shape and treats an empty final report as fully covered', () => {
  assert.equal(reportTool.coverageFromFinal(null), null);
  assert.equal(reportTool.coverageFromFinal({}), null);
  assert.equal(reportTool.coverageFromFinal(Object.create({ statementMap: {} })), null);

  const invalidMap = reportTool.coverageFromFinal({ statementMap: [], s: {} });
  const invalidCounts = reportTool.coverageFromFinal({ statementMap: {}, s: null });
  const empty = reportTool.coverageFromFinal({ statementMap: {}, s: {} });

  assert.deepEqual(invalidMap, {
    ok: false,
    error: 'statementMap and s must be objects',
  });
  assert.deepEqual(invalidCounts, {
    ok: false,
    error: 'statementMap and s must be objects',
  });
  assert.deepEqual(empty, { ok: true, percentage: 100 });
});

test('coverage-final rejects mismatched statement-map and count identifiers', () => {
  const extraCount = reportTool.coverageFromFinal({
    statementMap: {},
    s: { 0: 0 },
  });
  const missingCount = reportTool.coverageFromFinal({
    statementMap: { 0: { start: { line: 1 } } },
    s: {},
  });

  for (const result of [extraCount, missingCount]) {
    assert.deepEqual(result, {
      ok: false,
      error: 'statementMap and s must contain identical statement ids',
    });
  }
});

test('coverage-final counts a source line once when multiple statements share it', () => {
  const result = reportTool.coverageFromFinal({
    statementMap: {
      0: { start: { line: 7 } },
      1: { start: { line: 7 } },
      2: { start: { line: 8 } },
    },
    s: { 0: 0, 1: 2, 2: 0 },
  });

  assert.deepEqual(result, { ok: true, percentage: 50 });
});

test('a basename-only target is not guessed from report suffixes', () => {
  const report = {
    '/workspace/src/a/Button.tsx': { lines: { total: 1, covered: 1, pct: 100 } },
  };

  const result = reportTool.findCoverage(report, 'Button.tsx', '/workspace');

  assert.equal(result.ok, false);
  assert.equal(result.kind, 'missing');
});

test('an exact path selects the requested package', () => {
  const report = {
    '/workspace/src/a/Button.tsx': { lines: { total: 1, covered: 1, pct: 100 } },
    '/workspace/src/b/Button.tsx': { lines: { total: 4, covered: 1, pct: 25 } },
  };

  const result = reportTool.findCoverage(report, 'src/b/Button.tsx', '/workspace');

  assert.equal(result.ok, true);
  assert.equal(result.key, '/workspace/src/b/Button.tsx');
  assert.equal(result.percentage, 25);
});

test('a directory-qualified target cannot suffix-match another package', () => {
  const report = {
    '/repo/packages/b/src/Foo.ts': { lines: { total: 1, covered: 1, pct: 100 } },
  };

  const result = reportTool.findCoverage(report, 'src/Foo.ts', '/repo/packages/a');

  assert.equal(result.ok, false);
  assert.equal(result.kind, 'missing');
});

test('findCoverage rejects invalid report shapes and ambiguous exact matches', () => {
  for (const report of [null, [], 'coverage']) {
    const invalid = reportTool.findCoverage(report, 'src/Target.ts', '/workspace');
    assert.equal(invalid.ok, false);
    assert.equal(invalid.kind, 'invalid-report');
    assert.match(invalid.error, /must be an object/u);
  }

  const ambiguous = reportTool.findCoverage(
    {
      '/workspace/src/Target.ts': { lines: { total: 1, covered: 1, pct: 100 } },
      'src/Target.ts': { lines: { total: 1, covered: 1, pct: 100 } },
    },
    'src/Target.ts',
    '/workspace',
  );

  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.kind, 'ambiguous');
  assert.match(ambiguous.error, /Ambiguous coverage target/u);
  assert.match(ambiguous.error, /\/workspace\/src\/Target\.ts/u);
});

test('findCoverage reports malformed and unsupported coverage entries', () => {
  const malformed = reportTool.findCoverage(
    { '/workspace/src/Malformed.ts': { lines: [] } },
    'src/Malformed.ts',
    '/workspace',
  );
  const unsupported = reportTool.findCoverage(
    { '/workspace/src/Unsupported.ts': {} },
    'src/Unsupported.ts',
    '/workspace',
  );

  assert.equal(malformed.ok, false);
  assert.equal(malformed.kind, 'invalid-entry');
  assert.match(malformed.error, /lines summary is not an object/u);
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.kind, 'invalid-entry');
  assert.match(unsupported.error, /unsupported coverage entry format/u);
});

test('exact matching canonicalizes filesystem aliases', (testContext) => {
  const workspace = createWorkspace(testContext);
  const realRoot = path.join(workspace, 'real');
  const aliasRoot = path.join(workspace, 'alias');
  fs.mkdirSync(realRoot);
  try {
    fs.symlinkSync(realRoot, aliasRoot, 'dir');
  } catch {
    testContext.skip('directory symlinks are unavailable in this environment');
    return;
  }

  const realTarget = writeFile(realRoot, 'src/Target.ts', 'export const value = 1;');
  const aliasTarget = path.join(aliasRoot, 'src', 'Target.ts');
  const report = {
    [realTarget]: { lines: { total: 1, covered: 1, pct: 100 } },
  };

  const result = reportTool.findCoverage(report, aliasTarget, workspace);

  assert.equal(result.ok, true);
  assert.equal(result.key, realTarget);
  assert.equal(result.percentage, 100);
});

test('Windows drive paths compare case-insensitively', () => {
  const report = {
    'C:\\Repo\\src\\Target.ts': { lines: { total: 1, covered: 1, pct: 100 } },
  };

  const result = reportTool.findCoverage(
    report,
    'c:/repo/src/target.ts',
    'C:/Repo',
  );

  assert.equal(result.ok, true);
  assert.equal(result.key, 'C:\\Repo\\src\\Target.ts');
});

test('Windows UNC paths retain their share root and compare case-insensitively', () => {
  const report = {
    '\\\\Server\\Share\\Repo\\src\\Target.ts': {
      lines: { total: 1, covered: 1, pct: 100 },
    },
  };

  const result = reportTool.findCoverage(
    report,
    '//server/share/repo/src/target.ts',
    '//Server/Share/Repo',
  );

  assert.equal(result.ok, true);
  assert.equal(result.key, '\\\\Server\\Share\\Repo\\src\\Target.ts');
});

test('a null summary percentage falls back to covered and total counts', () => {
  const result = reportTool.coverageFromSummary({
    lines: { total: 4, covered: 3, skipped: 0, pct: null },
  });

  assert.deepEqual(result, { ok: true, percentage: 75 });
});

test('summary coverage validates ownership and line-summary shape', () => {
  assert.equal(reportTool.coverageFromSummary(null), null);
  assert.equal(reportTool.coverageFromSummary({}), null);
  assert.equal(reportTool.coverageFromSummary(Object.create({ lines: {} })), null);
  assert.deepEqual(reportTool.coverageFromSummary({ lines: null }), {
    ok: false,
    error: 'the lines summary is not an object',
  });
});

test('summary coverage rejects invalid or inconsistent totals', () => {
  const negative = reportTool.coverageFromSummary({
    lines: { total: -10, covered: -10, skipped: 0, pct: 100 },
  });
  const inconsistent = reportTool.coverageFromSummary({
    lines: { total: 10, covered: 0, skipped: 0, pct: 100 },
  });
  const booleanCount = reportTool.coverageFromSummary({
    lines: { total: true, covered: 1, skipped: 0, pct: 100 },
  });
  const stringCount = reportTool.coverageFromSummary({
    lines: { total: '1', covered: 1, skipped: 0, pct: 100 },
  });

  assert.equal(negative.ok, false);
  assert.match(negative.error, /invalid totals/u);
  assert.equal(inconsistent.ok, false);
  assert.match(inconsistent.error, /conflicts with its totals/u);
  assert.equal(booleanCount.ok, false);
  assert.match(booleanCount.error, /invalid totals/u);
  assert.equal(stringCount.ok, false);
  assert.match(stringCount.error, /invalid totals/u);
});

test('summary coverage rejects unsafe totals and invalid reported percentages', () => {
  for (const lines of [
    { total: 1, covered: 2, pct: 100 },
    { total: 1.5, covered: 1, pct: 100 },
    { total: Number.MAX_SAFE_INTEGER + 1, covered: 1, pct: 100 },
  ]) {
    const result = reportTool.coverageFromSummary({ lines });
    assert.equal(result.ok, false);
    assert.match(result.error, /invalid totals/u);
  }

  for (const pct of ['100', -1, 100.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = reportTool.coverageFromSummary({
      lines: { total: 1, covered: 1, pct },
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /invalid percentage/u);
  }
});

test('summary coverage accepts omitted percentages and zero totals', () => {
  const omitted = reportTool.coverageFromSummary({
    lines: { total: 2, covered: 1 },
  });
  const emptyString = reportTool.coverageFromSummary({
    lines: { total: 0, covered: 0, pct: '' },
  });

  assert.deepEqual(omitted, { ok: true, percentage: 50 });
  assert.deepEqual(emptyString, { ok: true, percentage: 100 });
});

test('computed percentages use Istanbul-compatible truncation', () => {
  const twoOfThree = reportTool.coverageFromSummary({
    lines: { total: 3, covered: 2, skipped: 0, pct: 66.66 },
  });

  assert.equal(twoOfThree.ok, true);
  assert.equal(twoOfThree.percentage, 66.66);
  assert.equal(reportTool.formatPercentage(twoOfThree.percentage), '66.66');
});

test('whole-number percentages do not underflow from floating-point error', () => {
  for (const [covered, total, expected] of [
    [58, 100, 58],
    [29, 50, 58],
    [57, 100, 57],
  ]) {
    const result = reportTool.coverageFromSummary({
      lines: { total, covered, skipped: 0, pct: expected },
    });

    assert.equal(result.ok, true);
    assert.equal(result.percentage, expected);
    assert.equal(reportTool.formatPercentage(result.percentage), String(expected));
  }
});

test('formatting preserves exact hundredths without hiding real fractions', () => {
  for (const value of [0.29, 0.57, 0.58, 1.13, 2.01, 58.58]) {
    assert.equal(reportTool.formatPercentage(value), String(value));
  }
  assert.equal(reportTool.formatPercentage((2 / 3) * 100), '66.66');
});

test('Istanbul 110-of-193 coverage remains 56.99 in CLI evidence', (testContext) => {
  const workspace = createWorkspace(testContext);
  const target = path.join(workspace, 'src', 'Fraction.ts');
  writeJson(workspace, 'coverage-summary.json', {
    [target]: { lines: { total: 193, covered: 110, skipped: 0, pct: 56.99 } },
  });

  const result = runCli(workspace, [
    '--min=56.99',
    'coverage-summary.json',
    'src/Fraction.ts',
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1. src/Fraction.ts - Line coverage: 56.99%\n');
  assert.equal(result.stderr, '');
});

test('bad JSON and missing targets return controlled failures', (testContext) => {
  const workspace = createWorkspace(testContext);
  writeFile(workspace, 'bad.json', '{not-json');
  const badJson = runCli(workspace, ['bad.json', 'src/Missing.ts']);

  assert.equal(badJson.status, 2);
  assert.match(badJson.stderr, /Coverage JSON not found or invalid: bad\.json/u);
  assert.doesNotMatch(badJson.stderr, /SyntaxError/u);

  writeJson(workspace, 'coverage.json', {
    '/workspace/src/Present.ts': { lines: { total: 1, covered: 1, pct: 100 } },
  });
  const missing = runCli(workspace, ['coverage.json', 'src/Missing.ts']);

  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No matching coverage entry found: src\/Missing\.ts/u);
});

test('CLI prints relative paths and enforces the optional minimum', (testContext) => {
  const workspace = createWorkspace(testContext);
  const target = path.join(workspace, 'src', 'feature', 'Target.tsx');
  writeJson(workspace, 'coverage-summary.json', {
    [target]: { lines: { total: 4, covered: 3, skipped: 0, pct: 75 } },
  });

  const passing = runCli(workspace, [
    '--min=75',
    'coverage-summary.json',
    'src/feature/Target.tsx',
  ]);
  assert.equal(passing.status, 0);
  assert.equal(passing.stdout, '1. src/feature/Target.tsx - Line coverage: 75%\n');
  assert.equal(passing.stderr, '');

  const failing = runCli(workspace, [
    '--min',
    '90',
    'coverage-summary.json',
    'src/feature/Target.tsx',
  ]);
  assert.equal(failing.status, 1);
  assert.equal(failing.stdout, '1. src/feature/Target.tsx - Line coverage: 75%\n');
  assert.match(failing.stderr, /Line coverage below 90%/u);
});

test('CLI enforces decimal thresholds from exact coverage counts', (testContext) => {
  const workspace = createWorkspace(testContext);
  const target = path.join(workspace, 'src', 'Boundary.ts');
  writeJson(workspace, 'coverage-summary.json', {
    [target]: { lines: { total: 3, covered: 2, skipped: 0, pct: 66.66 } },
  });

  const passing = runCli(workspace, [
    '--min=66.66',
    'coverage-summary.json',
    'src/Boundary.ts',
  ]);
  const failing = runCli(workspace, [
    '--min=66.67',
    'coverage-summary.json',
    'src/Boundary.ts',
  ]);

  assert.equal(passing.status, 0);
  assert.equal(failing.status, 1);
  assert.match(failing.stderr, /Line coverage below 66\.67%/u);
});

test('CLI accepts an exact whole-number threshold without floating underflow', (testContext) => {
  const workspace = createWorkspace(testContext);
  const target = path.join(workspace, 'src', 'Whole.ts');
  writeJson(workspace, 'coverage-summary.json', {
    [target]: { lines: { total: 100, covered: 58, skipped: 0, pct: null } },
  });

  const result = runCli(workspace, [
    '--min=58',
    'coverage-summary.json',
    'src/Whole.ts',
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1. src/Whole.ts - Line coverage: 58%\n');
  assert.equal(result.stderr, '');
});

test('CLI rejects a basename that does not resolve to the report path', (testContext) => {
  const workspace = createWorkspace(testContext);
  const target = path.join(workspace, 'src', 'feature', 'Unique.ts');
  writeJson(workspace, 'coverage-summary.json', {
    [target]: { lines: { total: 1, covered: 1, skipped: 0, pct: 100 } },
  });

  const result = runCli(workspace, ['coverage-summary.json', 'Unique.ts']);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /No matching coverage entry found: Unique\.ts/u);
});

test('argument parsing accepts only explicit decimal minimum percentages', () => {
  for (const [value, expected] of [
    ['0', 0],
    ['90', 90],
    ['90.5', 90.5],
    ['100', 100],
    ['100.00', 100],
  ]) {
    const parsed = reportTool.parseArguments([`--min=${value}`, 'report.json', 'src/A.ts']);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.minimum, expected);
  }

  for (const value of [
    '',
    ' ',
    '0x5a',
    '9e1',
    '+90',
    '-0',
    'NaN',
    'Infinity',
    '100.01',
    '.5',
    '90.',
  ]) {
    const parsed = reportTool.parseArguments([`--min=${value}`, 'report.json', 'src/A.ts']);
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /Invalid --min value/u);
  }

  const missing = reportTool.parseArguments(['--min']);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /Invalid --min value/u);
});

test('argument parsing rejects repeated minimum options', () => {
  for (const argumentsList of [
    ['--min=90', '--min=91', 'report.json', 'src/A.ts'],
    ['--min', '90', '--min=91', 'report.json', 'src/A.ts'],
    ['--min=90', '--min', '91', 'report.json', 'src/A.ts'],
  ]) {
    const parsed = reportTool.parseArguments(argumentsList);
    assert.deepEqual(parsed, { ok: false, error: 'Duplicate option: --min' });
  }
});

test('CLI help, usage errors, and unknown options are deterministic', (testContext) => {
  const workspace = createWorkspace(testContext);

  for (const helpOption of ['--help', '-h']) {
    const help = runCli(workspace, [helpOption]);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: node vitest_line_report\.cjs/u);
    assert.equal(help.stderr, '');
  }

  for (const argumentsList of [[], ['coverage.json']]) {
    const usage = runCli(workspace, argumentsList);
    assert.equal(usage.status, 2);
    assert.equal(usage.stdout, '');
    assert.match(usage.stderr, /^Usage: node vitest_line_report\.cjs/u);
  }

  const unknown = runCli(workspace, ['--wat']);
  assert.equal(unknown.status, 2);
  assert.equal(unknown.stdout, '');
  assert.match(unknown.stderr, /^Unknown option: --wat/mu);
  assert.match(unknown.stderr, /^Usage: node vitest_line_report\.cjs/mu);
});

test('CLI rejects missing reports, invalid report shapes, and repeated minimums', (testContext) => {
  const workspace = createWorkspace(testContext);
  const missing = runCli(workspace, ['missing.json', 'src/A.ts']);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /Coverage JSON not found or invalid: missing\.json/u);

  writeJson(workspace, 'array.json', []);
  const invalidShape = runCli(workspace, ['array.json', 'src/A.ts']);
  assert.equal(invalidShape.status, 1);
  assert.match(invalidShape.stderr, /coverage report must be an object/u);

  const repeated = runCli(workspace, [
    '--min=90',
    '--min',
    '90',
    'array.json',
    'src/A.ts',
  ]);
  assert.equal(repeated.status, 2);
  assert.match(repeated.stderr, /^Duplicate option: --min/mu);
  assert.match(repeated.stderr, /^Usage: node vitest_line_report\.cjs/mu);
});

test('a failed target still consumes its input number', (testContext) => {
  const workspace = createWorkspace(testContext);
  const passingTarget = path.join(workspace, 'src', 'Passing.ts');
  writeJson(workspace, 'coverage-summary.json', {
    total: { lines: { total: 1, covered: 1, pct: 100 } },
    [passingTarget]: { lines: { total: 1, covered: 1, pct: 100 } },
  });

  const result = runCli(workspace, [
    'coverage-summary.json',
    'src/Missing.ts',
    'src/Passing.ts',
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '2. src/Passing.ts - Line coverage: 100%\n');
  assert.match(result.stderr, /No matching coverage entry found: src\/Missing\.ts/u);
});

test('run covers in-process help, usage, report, and target failure paths', (testContext) => {
  const workspace = createWorkspace(testContext);
  const help = runInMemory(['--help'], workspace);
  const unknown = runInMemory(['--unknown'], workspace);
  const missingArguments = runInMemory([], workspace);
  const missingReport = runInMemory(['missing.json', 'src/A.ts'], workspace);

  assert.equal(help.status, 0);
  assert.match(help.stdout[0], /^Usage:/u);
  assert.deepEqual(help.stderr, []);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr[0], /Unknown option/u);
  assert.match(unknown.stderr[1], /^Usage:/u);
  assert.equal(missingArguments.status, 2);
  assert.match(missingArguments.stderr[0], /^Usage:/u);
  assert.equal(missingReport.status, 2);
  assert.match(missingReport.stderr[0], /Coverage JSON not found or invalid/u);
});

test('run reports success and preserves numbering across target failures', (testContext) => {
  const workspace = createWorkspace(testContext);
  const passingTarget = path.join(workspace, 'src', 'Passing.ts');
  writeJson(workspace, 'coverage-summary.json', {
    [passingTarget]: { lines: { total: 4, covered: 3, pct: 75 } },
  });

  const result = runInMemory(
    [
      '--min=80',
      'coverage-summary.json',
      'src/Missing.ts',
      'src/Passing.ts',
    ],
    workspace,
  );

  assert.equal(result.status, 1);
  assert.deepEqual(result.stdout, ['2. src/Passing.ts - Line coverage: 75%']);
  assert.match(result.stderr[0], /No matching coverage entry found/u);
  assert.match(result.stderr[1], /Line coverage below 80%/u);
});
