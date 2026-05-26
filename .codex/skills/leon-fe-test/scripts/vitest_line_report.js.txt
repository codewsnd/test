#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function normalizeTarget(target) {
  return path.resolve(target).replace(/\\/g, '/');
}

function keyMatches(rawKey, target) {
  const key = path.resolve(rawKey).replace(/\\/g, '/');
  const normalizedRawKey = rawKey.replace(/\\/g, '/');
  const normalizedTarget = target.replace(/\\/g, '/');

  return (
    key === target ||
    normalizedRawKey === normalizedTarget ||
    key.endsWith(`/${normalizedTarget}`) ||
    normalizedRawKey.endsWith(`/${normalizedTarget}`) ||
    path.basename(rawKey) === path.basename(normalizedTarget)
  );
}

function coverageFromSummary(entry) {
  if (!entry || !entry.lines) {
    return null;
  }

  const pct = Number(entry.lines.pct);
  if (Number.isFinite(pct)) {
    return pct;
  }

  const total = Number(entry.lines.total || 0);
  const covered = Number(entry.lines.covered || 0);
  return total === 0 ? 100 : (covered / total) * 100;
}

function coverageFromFinal(entry) {
  if (!entry || !entry.statementMap || !entry.s) {
    return null;
  }

  const executableLines = new Map();
  for (const [statementId, location] of Object.entries(entry.statementMap)) {
    const count = Number(entry.s[statementId] || 0);
    const start = Number(location.start && location.start.line);
    const end = Number((location.end && location.end.line) || start);

    if (!Number.isFinite(start)) {
      continue;
    }

    for (let line = start; line <= end; line += 1) {
      executableLines.set(line, (executableLines.get(line) || 0) + count);
    }
  }

  if (executableLines.size === 0) {
    return 100;
  }

  let covered = 0;
  for (const count of executableLines.values()) {
    if (count > 0) {
      covered += 1;
    }
  }

  return (covered / executableLines.size) * 100;
}

function formatPercent(percent) {
  return percent.toFixed(2).replace(/\.?0+$/, '');
}

function findCoverage(report, target) {
  const matches = [];

  for (const [key, entry] of Object.entries(report)) {
    if (key === 'total') {
      continue;
    }
    if (!keyMatches(key, target)) {
      continue;
    }

    const pct = coverageFromSummary(entry) ?? coverageFromFinal(entry);
    if (pct !== null) {
      matches.push({ key, pct });
    }
  }

  return matches;
}

function main(argv) {
  const [coverageJson, ...targets] = argv;
  if (!coverageJson || targets.length === 0) {
    console.error('Usage: node vitest_line_report.js coverage/coverage-summary.json src/foo/Target.tsx [...]');
    return 2;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(path.resolve(coverageJson), 'utf8'));
  } catch (error) {
    console.error(`Coverage JSON not found or invalid: ${coverageJson}`);
    return 2;
  }

  let exitCode = 0;
  let outputIndex = 1;
  for (const rawTarget of targets) {
    const target = normalizeTarget(rawTarget);
    const matches = findCoverage(report, target);

    if (matches.length === 0) {
      console.error(`No matching coverage entry found: ${rawTarget}`);
      exitCode = 1;
      continue;
    }

    matches.forEach((match) => {
      console.log(`${outputIndex}. ${path.basename(match.key)} - Line coverage: ${formatPercent(match.pct)}%`);
      outputIndex += 1;
    });
  }

  return exitCode;
}

process.exitCode = main(process.argv.slice(2));
