'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const SKILL_ROOT = path.resolve(__dirname, '..');
const REQUIRED_REFERENCES = [
  'references/coverage-and-timeouts.md',
  'references/react-boundaries.md',
  'references/testing-patterns.md',
];
const FORBIDDEN_FILES = [
  'CHANGELOG.md',
  'INSTALLATION_GUIDE.md',
  'QUICK_REFERENCE.md',
  'README.md',
];

function readSkillFile(relativePath) {
  return fs.readFileSync(path.join(SKILL_ROOT, relativePath), 'utf8');
}

function parseFrontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(markdown);
  assert.ok(match, 'SKILL.md must start with YAML frontmatter');
  return match[1]
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(0, line.indexOf(':')));
}

function markdownFiles() {
  return [
    'SKILL.md',
    ...fs
      .readdirSync(path.join(SKILL_ROOT, 'references'))
      .filter((filename) => filename.endsWith('.md'))
      .map((filename) => path.join('references', filename)),
  ];
}

function localMarkdownTargets(markdown) {
  const targets = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;
  for (const match of markdown.matchAll(linkPattern)) {
    const target = match[1];
    if (!target.startsWith('#') && !/^https?:/u.test(target)) {
      targets.push(target.split('#')[0]);
    }
  }
  return targets.filter(Boolean);
}

function quotedYamlValue(yaml, key) {
  const pattern = new RegExp(`^  ${key}: "([^"]+)"$`, 'mu');
  return pattern.exec(yaml)?.[1];
}

test('SKILL frontmatter exposes only the supported trigger fields', () => {
  const keys = parseFrontmatter(readSkillFile('SKILL.md'));
  assert.deepEqual(keys, ['name', 'description']);
});

test('SKILL directly routes every conditional reference', () => {
  const skill = readSkillFile('SKILL.md');
  for (const reference of REQUIRED_REFERENCES) {
    assert.match(skill, new RegExp(`\\(${reference.replaceAll('.', '\\.')}\\)`, 'u'));
  }
});

test('all local Markdown links resolve', () => {
  for (const relativePath of markdownFiles()) {
    const directory = path.dirname(path.join(SKILL_ROOT, relativePath));
    for (const target of localMarkdownTargets(readSkillFile(relativePath))) {
      assert.ok(
        fs.existsSync(path.resolve(directory, target)),
        `${relativePath} contains a missing link target: ${target}`,
      );
    }
  }
});

test('long references provide a table of contents', () => {
  for (const relativePath of REQUIRED_REFERENCES) {
    const markdown = readSkillFile(relativePath);
    if (markdown.split('\n').length > 100) {
      assert.match(markdown, /^## Table of Contents$/mu);
    }
  }
});

test('UI metadata is quoted, bounded, and invokes the skill explicitly', () => {
  const yaml = readSkillFile('agents/openai.yaml');
  const displayName = quotedYamlValue(yaml, 'display_name');
  const shortDescription = quotedYamlValue(yaml, 'short_description');
  const defaultPrompt = quotedYamlValue(yaml, 'default_prompt');

  assert.equal(displayName, 'Leon Frontend Tests');
  assert.ok(shortDescription);
  assert.ok(shortDescription.length >= 25 && shortDescription.length <= 64);
  assert.ok(defaultPrompt);
  assert.match(defaultPrompt, /\$leon-fe-test/u);
});

test('task modes preserve read-only diagnosis and explicit validation evidence', () => {
  const skill = readSkillFile('SKILL.md');
  for (const mode of ['Diagnose / Review', 'Write / Repair', 'Raise Coverage', 'Validate']) {
    assert.match(skill, new RegExp(mode.replace('/', '\\/'), 'u'));
  }
  assert.match(skill, /A request to explain, review, or diagnose does not authorize a fix\./u);
  assert.match(skill, /do not recursively scan source files or launch tests/u);
  assert.match(skill, /Never estimate coverage/u);
});

test('the distributable skill contains no auxiliary documentation', () => {
  for (const filename of FORBIDDEN_FILES) {
    assert.equal(fs.existsSync(path.join(SKILL_ROOT, filename)), false);
  }
});
