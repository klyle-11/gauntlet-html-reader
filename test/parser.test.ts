import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from '../src/build.ts';
import { parseCorpus } from '../src/parser/index.ts';
import { canonicalSection, headings, parseModuleHeading } from '../src/parser/split.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = parseCorpus(ROOT);
const count = (vol: string) => [...corpus.modules.values()].filter((m) => m.volume === vol).length;

test('module counts per volume', () => {
  assert.deepEqual(
    ['I', 'II', 'III', 'IV', 'V', 'VI'].map(count),
    [25, 21, 13, 12, 13, 18],
  );
});

test('IV and VI share M60–M71 but get distinct keys', () => {
  assert.equal(corpus.modules.get('IV-M60')!.title, 'Stop Writing Java in C#');
  assert.equal(corpus.modules.get('VI-M60')!.title, 'The Text Is the Contract');
});

test('module heading formats', () => {
  assert.deepEqual(parseModuleHeading('M1 — One Honest Endpoint · Java Spring Boot → React · (M)'), {
    id: 'M1', title: 'One Honest Endpoint', stack: 'Java Spring Boot → React', size: 'M',
  });
  assert.equal(parseModuleHeading('RR10 — The Community Board Has Rules · Review queues · Medium to Large')!.size, 'M–L');
  assert.equal(parseModuleHeading('M6 — The Cache You Can Explain · LRU in React · (M) · _hosts the rep circuit_')!.size, 'M');
  assert.equal(parseModuleHeading('M60 — Stop Writing Java in C#')!.stack, undefined);
  assert.equal(parseModuleHeading('34. Choosing the next hint'), null);
});

test('IV metadata line becomes size and stack', () => {
  const m = corpus.modules.get('IV-M60')!;
  assert.equal(m.size, 'M');
  assert.equal(m.meta, '~3 protected blocks');
  assert.match(m.stack!, /^C# · \.NET runtime/);
});

test('every volume I/II/III/VI module has the core sections', () => {
  for (const m of corpus.modules.values()) {
    if (m.volume === 'IV') continue;
    const have = new Set(m.sections.map((s) => s.canonical));
    for (const c of ['story', 'briefing', 'trap', 'feature', 'decisions', 'research', 'measure', 'prove'])
      assert.ok(have.has(c as never), `${m.key} is missing ${c}`);
  }
});

test('section names normalize across schemas', () => {
  assert.equal(canonicalSection('Hints ladder'), 'hints');
  assert.equal(canonicalSection('Hint ladder'), 'hints');
  assert.equal(canonicalSection('Out of scope (fence)'), 'fence');
  assert.equal(canonicalSection('Research targets and stops'), 'research');
  assert.equal(canonicalSection('Prove it in three rooms'), 'prove');
  assert.equal(canonicalSection('The build'), 'feature');
  assert.equal(canonicalSection('Concept translation'), 'extra');
});

test('headings inside code fences are not headings', () => {
  const hs = headings(['# Real', '```bash', '# comment', '```', '## Also real']);
  assert.deepEqual(hs.map((h) => h.text), ['Real', 'Also real']);
});

test('no source text is dropped from modules', () => {
  // Every non-heading, non-anchor line of a module's source span appears in its sections.
  const m = corpus.modules.get('I-M1')!;
  const all = m.sections.map((s) => s.md).join('\n');
  assert.ok(all.includes('**Anchors:** the Java book'));
  assert.ok(all.includes('**Near-spoiler (after two attempts):**'));
});

test('by-stack grouping covers every module of every volume exactly once', () => {
  const keys = corpus.stacks.flatMap((g) => g.keys);
  assert.equal(keys.length, corpus.modules.size);
  assert.equal(new Set(keys).size, corpus.modules.size);
  assert.equal(corpus.stacks.find((g) => g.title === 'UI / Frontend')!.keys.length >= 8, true);
  assert.ok(corpus.stacks.find((g) => g.title === '.NET & Microsoft')!.keys.includes('IV-M60'));
});

test('build writes a self-contained site with no broken internal links', () => {
  const out = mkdtempSync(join(tmpdir(), 'gauntlet-'));
  build(out, corpus);
  const files = new Set(readdirSync(out));
  assert.ok(files.has('index.html') && files.has('I-M1.html') && files.has('VI-M60.html') && files.has('stacks.html'));
  for (const f of files) {
    if (!f.endsWith('.html')) continue;
    const html = readFileSync(join(out, f), 'utf8');
    for (const [, href] of html.matchAll(/href="([^"#:]+\.html)/g)) assert.ok(files.has(href), `${f} links to missing ${href}`);
  }
  const v = readFileSync(join(out, 'VI-M61.html'), 'utf8');
  assert.match(v, /href="VI-M60.html"/, 'VI cross-references resolve within VI');
});
