#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;
const SUCCESS = 0;
const DECIMAL_PERCENTAGE_PATTERN = /^(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)$/u;
const USAGE =
  'Usage: node vitest_line_report.cjs [--min <0-100>] <coverage.json> <target> [...]';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, property) {
  return Object.prototype.hasOwnProperty.call(value, property);
}

function normalizePortable(value) {
  const portable = String(value).replace(/\\/g, '/');
  const normalized = isWindowsAbsolute(portable)
    ? path.win32.normalize(portable).replace(/\\/g, '/')
    : path.posix.normalize(portable);
  const isRoot =
    normalized === '/' ||
    /^[A-Za-z]:\/$/u.test(normalized) ||
    /^\/\/[^/]+\/[^/]+\/?$/u.test(normalized);
  if (!isRoot && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:\//u.test(value) || /^\/\/[^/]+\/[^/]+(?:\/|$)/u.test(value);
}

function pathApiFor(value) {
  return isWindowsAbsolute(normalizePortable(value)) ? path.win32 : path.posix;
}

function canonicalizeExistingPath(value) {
  const normalized = normalizePortable(value);
  const missingSegments = [];
  let existingPath = normalized;
  const pathApi = pathApiFor(normalized);

  while (!fs.existsSync(existingPath)) {
    const parent = normalizePortable(pathApi.dirname(existingPath));
    if (parent === existingPath) {
      return normalized;
    }
    missingSegments.unshift(pathApi.basename(existingPath));
    existingPath = parent;
  }

  try {
    const realPath = normalizePortable(fs.realpathSync.native(existingPath));
    return normalizePortable(pathApi.join(realPath, ...missingSegments));
  } catch {
    return normalized;
  }
}

function toAbsolute(value, cwd = process.cwd()) {
  const normalized = normalizePortable(value);
  if (isWindowsAbsolute(normalized)) {
    return canonicalizeExistingPath(normalized);
  }
  const normalizedCwd = normalizePortable(cwd);
  const resolver = isWindowsAbsolute(normalizedCwd) ? path.win32 : path;
  const absolute = path.posix.isAbsolute(normalized)
    ? normalized
    : normalizePortable(resolver.resolve(normalizedCwd, normalized));
  return canonicalizeExistingPath(absolute);
}

function comparablePath(value) {
  const normalized = normalizePortable(value);
  return isWindowsAbsolute(normalized) ? normalized.toLowerCase() : normalized;
}

function pathsAreExact(key, target, cwd) {
  return (
    comparablePath(key) === comparablePath(target) ||
    comparablePath(toAbsolute(key, cwd)) === comparablePath(toAbsolute(target, cwd))
  );
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validPercentage(value) {
  const percentage = finiteNumber(value);
  if (percentage === null || percentage < 0 || percentage > 100) {
    return null;
  }
  return percentage;
}

function coverageCount(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function haveIdenticalKeys(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length && leftKeys.every((key) => hasOwn(right, key))
  );
}

function istanbulPercentage(covered, total) {
  if (total === 0) {
    return 100;
  }
  const basisPoints = (BigInt(covered) * 10_000n) / BigInt(total);
  return Number(basisPoints) / 100;
}

function coverageFromCounts(lines) {
  const total = coverageCount(lines.total);
  const covered = coverageCount(lines.covered);
  if (total === null || covered === null || covered > total) {
    return { ok: false, error: 'the lines summary has invalid totals' };
  }
  return { ok: true, percentage: istanbulPercentage(covered, total) };
}

function validateReportedPercentage(lines, calculatedPercentage) {
  if (lines.pct === null || lines.pct === undefined || lines.pct === '') {
    return { ok: true };
  }
  if (typeof lines.pct !== 'number' || validPercentage(lines.pct) === null) {
    return { ok: false, error: 'the lines summary has an invalid percentage' };
  }
  if (formatPercentage(lines.pct) !== formatPercentage(calculatedPercentage)) {
    return { ok: false, error: 'the lines summary percentage conflicts with its totals' };
  }
  return { ok: true };
}

function coverageFromSummary(entry) {
  if (!isObject(entry) || !hasOwn(entry, 'lines')) {
    return null;
  }
  if (!isObject(entry.lines)) {
    return { ok: false, error: 'the lines summary is not an object' };
  }

  const calculated = coverageFromCounts(entry.lines);
  if (!calculated.ok) {
    return calculated;
  }
  const reported = validateReportedPercentage(entry.lines, calculated.percentage);
  return reported.ok ? calculated : reported;
}

function statementLineCounts(entry) {
  const counts = new Map();
  for (const [statementId, location] of Object.entries(entry.statementMap)) {
    const line = location?.start?.line;
    const count = coverageCount(entry.s[statementId]);
    if (typeof line !== 'number' || !Number.isSafeInteger(line) || line < 1 || count === null) {
      return { ok: false, error: `statement ${statementId} has invalid coverage data` };
    }
    counts.set(line, Math.max(counts.get(line) ?? 0, count));
  }
  return { ok: true, counts };
}

function coverageFromFinal(entry) {
  if (!isObject(entry) || !hasOwn(entry, 'statementMap')) {
    return null;
  }
  if (!isObject(entry.statementMap) || !isObject(entry.s)) {
    return { ok: false, error: 'statementMap and s must be objects' };
  }
  if (!haveIdenticalKeys(entry.statementMap, entry.s)) {
    return { ok: false, error: 'statementMap and s must contain identical statement ids' };
  }

  const lineResult = statementLineCounts(entry);
  if (!lineResult.ok) {
    return lineResult;
  }
  if (lineResult.counts.size === 0) {
    return { ok: true, percentage: 100 };
  }

  const covered = [...lineResult.counts.values()].filter((count) => count > 0).length;
  return { ok: true, percentage: istanbulPercentage(covered, lineResult.counts.size) };
}

function coverageForEntry(entry) {
  const summaryResult = coverageFromSummary(entry);
  if (summaryResult !== null) {
    return summaryResult;
  }

  const finalResult = coverageFromFinal(entry);
  if (finalResult !== null) {
    return finalResult;
  }
  return { ok: false, error: 'unsupported coverage entry format' };
}

function reportEntries(report) {
  if (!isObject(report)) {
    return null;
  }
  return Object.entries(report).filter(([key]) => key !== 'total');
}

function matchingEntries(entries, target, cwd) {
  return entries.filter(([key]) => pathsAreExact(key, target, cwd));
}

function findCoverage(report, target, cwd = process.cwd()) {
  const entries = reportEntries(report);
  if (entries === null) {
    return { ok: false, kind: 'invalid-report', error: 'coverage report must be an object' };
  }

  const matches = matchingEntries(entries, target, cwd);
  if (matches.length === 0) {
    return { ok: false, kind: 'missing', error: `No matching coverage entry found: ${target}` };
  }
  if (matches.length > 1) {
    const keys = matches.map(([key]) => key).join(', ');
    return { ok: false, kind: 'ambiguous', error: `Ambiguous coverage target ${target}: ${keys}` };
  }

  const [key, entry] = matches[0];
  const coverage = coverageForEntry(entry);
  if (!coverage.ok) {
    return { ok: false, kind: 'invalid-entry', error: `Invalid coverage entry ${key}: ${coverage.error}` };
  }
  return { ok: true, key, percentage: coverage.percentage };
}

function parseMinimum(value) {
  if (typeof value !== 'string' || !DECIMAL_PERCENTAGE_PATTERN.test(value)) {
    return { ok: false, error: `Invalid --min value: ${value}` };
  }
  const minimum = Number(value);
  return { ok: true, minimum };
}

function minimumArgument(argv, index) {
  const argument = argv[index];
  if (argument === '--min') {
    return { matched: true, value: argv[index + 1], consumed: 1 };
  }
  if (argument.startsWith('--min=')) {
    return { matched: true, value: argument.slice('--min='.length), consumed: 0 };
  }
  return { matched: false, consumed: 0 };
}

function parseMinimumOption(minimumOption, hasMinimum) {
  if (hasMinimum) {
    return { ok: false, error: 'Duplicate option: --min' };
  }
  return parseMinimum(minimumOption.value);
}

function parseArguments(argv) {
  const positional = [];
  let minimum = null;
  let hasMinimum = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      return { ok: true, help: true, minimum, positional };
    }
    const minimumOption = minimumArgument(argv, index);
    if (minimumOption.matched) {
      const parsed = parseMinimumOption(minimumOption, hasMinimum);
      if (!parsed.ok) {
        return parsed;
      }
      minimum = parsed.minimum;
      hasMinimum = true;
      index += minimumOption.consumed;
    } else if (argument.startsWith('-')) {
      return { ok: false, error: `Unknown option: ${argument}` };
    } else {
      positional.push(argument);
    }
  }
  return { ok: true, help: false, minimum, positional };
}

function formatPercentage(percentage) {
  const scaled = percentage * 100;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  const truncated = Math.floor(scaled + tolerance) / 100;
  return truncated.toFixed(2).replace(/\.?0+$/u, '');
}

function displayPath(key, cwd) {
  const absoluteCwd = toAbsolute('.', cwd);
  const absoluteKey = toAbsolute(key, cwd);
  const pathApi = isWindowsAbsolute(absoluteCwd) ? path.win32 : path.posix;
  const rawRelative = pathApi.relative(absoluteCwd, absoluteKey);
  const relative = rawRelative ? normalizePortable(rawRelative) : '';
  return relative || path.posix.basename(normalizePortable(key));
}

function readReport(coverageJson, cwd) {
  try {
    const reportPath = path.resolve(cwd, coverageJson);
    return { ok: true, report: JSON.parse(fs.readFileSync(reportPath, 'utf8')) };
  } catch {
    return { ok: false, error: `Coverage JSON not found or invalid: ${coverageJson}` };
  }
}

function reportTarget(result, rawTarget, minimum, outputIndex, cwd, streams) {
  if (!result.ok) {
    streams.error(result.error);
    return { exitCode: EXIT_FAILURE, outputIndex: outputIndex + 1 };
  }

  const percentage = formatPercentage(result.percentage);
  streams.log(`${outputIndex}. ${displayPath(result.key, cwd)} - Line coverage: ${percentage}%`);
  if (minimum !== null && result.percentage < minimum) {
    streams.error(
      `Line coverage below ${formatPercentage(minimum)}%: ${rawTarget} (${percentage}%)`,
    );
    return { exitCode: EXIT_FAILURE, outputIndex: outputIndex + 1 };
  }
  return { exitCode: SUCCESS, outputIndex: outputIndex + 1 };
}

function run(argv, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const streams = {
    log: options.log ?? console.log,
    error: options.error ?? console.error,
  };
  const parsed = parseArguments(argv);
  if (!parsed.ok) {
    streams.error(parsed.error);
    streams.error(USAGE);
    return EXIT_USAGE;
  }
  if (parsed.help) {
    streams.log(USAGE);
    return SUCCESS;
  }

  const [coverageJson, ...targets] = parsed.positional;
  if (!coverageJson || targets.length === 0) {
    streams.error(USAGE);
    return EXIT_USAGE;
  }

  const reportResult = readReport(coverageJson, cwd);
  if (!reportResult.ok) {
    streams.error(reportResult.error);
    return EXIT_USAGE;
  }

  let exitCode = SUCCESS;
  let outputIndex = 1;
  for (const target of targets) {
    const result = findCoverage(reportResult.report, target, cwd);
    const targetResult = reportTarget(
      result,
      target,
      parsed.minimum,
      outputIndex,
      cwd,
      streams,
    );
    exitCode = Math.max(exitCode, targetResult.exitCode);
    outputIndex = targetResult.outputIndex;
  }
  return exitCode;
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}

module.exports = {
  coverageFromFinal,
  coverageFromSummary,
  displayPath,
  findCoverage,
  formatPercentage,
  parseArguments,
  run,
};
