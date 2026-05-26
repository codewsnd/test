#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseAttrs(tag) {
  const attrs = {};
  const pattern = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  for (const match of tag.matchAll(pattern)) {
    attrs[match[1]] = match[2]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
  return attrs;
}

function normalizeTarget(target) {
  const marker = 'src/main/java/';
  let normalized = target.replace(/\\/g, '/');
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0) {
    normalized = normalized.slice(markerIndex + marker.length);
  }
  return normalized.replace(/^\.\//, '');
}

function sourceRows(xml) {
  const rows = [];
  const packagePattern = /<package\b([^>]*)>([\s\S]*?)<\/package>/g;

  for (const packageMatch of xml.matchAll(packagePattern)) {
    const packageName = parseAttrs(packageMatch[1]).name || '';
    const packageBody = packageMatch[2];
    const sourcePattern = /<sourcefile\b([^>]*)>([\s\S]*?)<\/sourcefile>/g;

    for (const sourceMatch of packageBody.matchAll(sourcePattern)) {
      const name = parseAttrs(sourceMatch[1]).name || '';
      const body = sourceMatch[2];
      const counterMatch = body.match(/<counter\b(?=[^>]*\btype="LINE")([^>]*)\/>/);
      const counter = counterMatch ? parseAttrs(counterMatch[1]) : {};
      const covered = Number.parseInt(counter.covered || '0', 10);
      const missed = Number.parseInt(counter.missed || '0', 10);
      const total = covered + missed;
      const percent = total === 0 ? 100 : (covered / total) * 100;
      const sourcePath = packageName ? `${packageName}/${name}` : name;

      rows.push({ sourcePath, name, covered, missed, total, percent });
    }
  }

  return rows.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
}

function formatPercent(percent) {
  return percent.toFixed(2).replace(/\.?0+$/, '');
}

function selectRows(rows, targets) {
  if (targets.length === 0) {
    return { selected: rows, missing: [] };
  }

  const selected = new Map();
  const missing = [];

  for (const rawTarget of targets) {
    const target = normalizeTarget(rawTarget);
    const matches = rows.filter((row) => (
      row.sourcePath === target ||
      row.sourcePath.endsWith(`/${target}`) ||
      row.name === target
    ));

    if (matches.length === 0) {
      missing.push(rawTarget);
    }

    for (const row of matches) {
      selected.set(row.sourcePath, row);
    }
  }

  return {
    selected: [...selected.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)),
    missing,
  };
}

function main(argv) {
  const [jacocoXml, ...targets] = argv;
  if (!jacocoXml) {
    console.error('Usage: node jacoco_line_report.js target/site/jacoco/jacoco.xml [source-file ...]');
    return 2;
  }

  let xml;
  try {
    xml = fs.readFileSync(path.resolve(jacocoXml), 'utf8');
  } catch (error) {
    console.error(`JaCoCo XML not found or unreadable: ${jacocoXml}`);
    return 2;
  }

  const { selected, missing } = selectRows(sourceRows(xml), targets);
  if (selected.length === 0) {
    console.error('No matching JaCoCo source files found.');
    return 1;
  }

  selected.forEach((row, index) => {
    console.log(`${index + 1}. ${path.basename(row.sourcePath)} - Line coverage: ${formatPercent(row.percent)}%`);
  });

  if (missing.length > 0) {
    console.error(`Missing targets: ${missing.join(', ')}`);
    return 1;
  }

  return 0;
}

process.exitCode = main(process.argv.slice(2));
