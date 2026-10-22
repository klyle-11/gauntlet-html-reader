import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCorpus } from './parser/index.ts';
import { githubSlug, headings } from './parser/split.ts';
import type { Corpus, Module, Volume } from './parser/types.ts';
import { createRenderer, type LinkContext } from './render/markdown.ts';
import {
  esc,
  layout,
  moduleBody,
  moduleCard,
  moduleFile,
  pageBody,
  pageFile,
  sectionId,
  volumeFile,
} from './render/templates.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function build(outDir: string, corpus = parseCorpus(ROOT)) {
  const md = createRenderer();
  const volumeOf = new Map(corpus.volumes.map((v) => [v.config.id, v]));

  // ID → keys, for resolving "M12" mentions. IV and VI both have M60–M71.
  const byId = new Map<string, string[]>();
  for (const m of corpus.modules.values()) byId.set(m.id, [...(byId.get(m.id) ?? []), m.key]);
  const siblings = (vol: string) => (vol === 'I' || vol === 'II' ? ['I', 'II'] : [vol]);
  const moduleHref = (vol: string) => (id: string) => {
    const keys = byId.get(id);
    if (!keys) return null;
    const near = keys.find((k) => siblings(vol).includes(corpus.modules.get(k)!.volume));
    if (near) return moduleFile(near);
    return keys.length === 1 ? moduleFile(keys[0]) : null;
  };

  // #fragment → href, per volume.
  const anchors = new Map<string, Map<string, string>>();
  for (const v of corpus.volumes) {
    const map = new Map<string, string>();
    const add = (a: string, href: string) => map.has(a) || map.set(a, href);
    for (const e of v.entries) {
      if (e.kind === 'module') for (const a of corpus.modules.get(e.key)!.anchors) add(a, moduleFile(e.key));
      if (e.kind === 'group') add(githubSlug(e.title), `${volumeFile(v.config.id)}#${githubSlug(e.title)}`);
      if (e.kind === 'page') {
        const p = corpus.pages.get(e.slug)!;
        for (const a of p.anchors) add(a, pageFile(p.slug));
        const lines = p.md.split('\n');
        for (const h of headings(lines)) add(githubSlug(h.text), `${pageFile(p.slug)}#${githubSlug(h.text)}`);
        for (const m of p.md.matchAll(/<a id="([^"]+)"><\/a>/g)) add(m[1], `${pageFile(p.slug)}#${m[1]}`);
      }
    }
    anchors.set(v.config.id, map);
  }

  // Volume V's modules say "read sections 3 and 4": numbered chapters are pages.
  const chapter = (vol: string) => (n: number) => {
    if (vol !== 'V') return null;
    const p = [...corpus.pages.values()].find((p) => p.volume === vol && p.title.startsWith(`${n}. `));
    return p ? pageFile(p.slug) : null;
  };

  const ctxFor = (vol: string, self: string): LinkContext => ({
    moduleHref: moduleHref(vol),
    anchorHref: (f) => anchors.get(vol)!.get(f) ?? anchors.get(vol)!.get(githubSlug(f)) ?? null,
    sectionHref: chapter(vol),
    self,
  });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(resolve(outDir, 'assets'), { recursive: true });

  const localMermaid = resolve(ROOT, 'node_modules/mermaid/dist/mermaid.min.js');
  let mermaidSrc = MERMAID_CDN;
  if (existsSync(localMermaid)) {
    copyFileSync(localMermaid, resolve(outDir, 'assets/mermaid.min.js'));
    mermaidSrc = 'assets/mermaid.min.js';
  }
  for (const f of ['app.css', 'app.js']) copyFileSync(resolve(ROOT, 'src/client', f), resolve(outDir, 'assets', f));
  // The stylesheet again as a script, so "Export HTML" can inline it even from file:// (where fetch and cssRules are blocked).
  const css = readFileSync(resolve(ROOT, 'src/client/app.css'), 'utf8');
  writeFileSync(resolve(outDir, 'assets/export-css.js'), `window.GAUNTLET_CSS=${JSON.stringify(css)};\n`);

  const write = (file: string, html: string) => writeFileSync(resolve(outDir, file), html);
  const page = (title: string, body: string, opts: { volume?: string; mermaid?: boolean } = {}) =>
    layout({ title, body, corpus, mermaidSrc, ...opts });
  const stackHtml = (m: Module) => (m.stack ? md.renderInline(m.stack) : '');

  for (const v of corpus.volumes) {
    const vid = v.config.id;
    // Reading order within a volume is file order.
    const seq = v.entries.filter((e) => e.kind !== 'group');
    const hrefOf = (e: (typeof seq)[number]) =>
      e.kind === 'module'
        ? { href: moduleFile(e.key), label: `${corpus.modules.get(e.key)!.id} — ${corpus.modules.get(e.key)!.title}` }
        : e.kind === 'page'
          ? { href: pageFile(e.slug), label: corpus.pages.get(e.slug)!.title }
          : undefined;

    seq.forEach((e, i) => {
      const prev = seq[i - 1] ? hrefOf(seq[i - 1]) : undefined;
      const next = seq[i + 1] ? hrefOf(seq[i + 1]) : undefined;
      if (e.kind === 'module') {
        const m = corpus.modules.get(e.key)!;
        const ctx = ctxFor(vid, moduleFile(m.key));
        const seen = new Set<string>();
        const sectionsHtml = m.sections.map((s) => ({
          id: sectionId(s.canonical, s.heading, seen),
          canonical: s.canonical,
          heading: s.heading,
          html: md.render(s.md, ctx),
        }));
        const mermaid = m.sections.some((s) => /^```mermaid/m.test(s.md));
        write(
          moduleFile(m.key),
          page(`${m.id} — ${m.title}`, moduleBody({ module: m, volume: v, sectionsHtml, stackHtml: stackHtml(m), prev, next }), {
            volume: vid,
            mermaid,
          }),
        );
      } else if (e.kind === 'page') {
        const p = corpus.pages.get(e.slug)!;
        const html = md.render(p.md, ctxFor(vid, pageFile(p.slug)));
        write(pageFile(p.slug), page(p.title, pageBody(p, v, html, prev, next), { volume: vid, mermaid: /^```mermaid/m.test(p.md) }));
      }
    });

    write(volumeFile(vid), page(v.config.title, volumeIndex(v, corpus, (src) => md.render(src, ctxFor(vid, volumeFile(vid))), stackHtml), { volume: vid }));
  }

  write('stacks.html', page('By stack', stackIndex(corpus, stackHtml)));
  write('index.html', page('Home', home(corpus, stackHtml)));
  return { modules: corpus.modules.size, pages: corpus.pages.size };
}

function volumeIndex(v: Volume, corpus: Corpus, render: (src: string) => string, stackHtml: (m: Module) => string) {
  const parts: string[] = [];
  let list: string[] = [];
  let reading: string[] = [];
  const flush = () => {
    if (reading.length) parts.push(`<ul class="reading-list">${reading.join('')}</ul>`);
    if (list.length) parts.push(`<ul class="cards">${list.join('')}</ul>`);
    list = [];
    reading = [];
  };
  for (const e of v.entries) {
    if (e.kind === 'group') {
      flush();
      parts.push(`<h2 id="${githubSlug(e.title)}">${esc(e.title)}</h2>${e.md ? `<div class="prose group-intro">${render(e.md)}</div>` : ''}`);
    } else if (e.kind === 'module') {
      if (reading.length) flush();
      list.push(moduleCard(corpus.modules.get(e.key)!, stackHtml(corpus.modules.get(e.key)!)));
    } else {
      if (list.length) flush();
      const p = corpus.pages.get(e.slug)!;
      reading.push(`<li><a href="${pageFile(p.slug)}">${esc(p.title)}</a></li>`);
    }
  }
  flush();
  const c = v.config;
  return `<div class="shell single"><main class="volume" data-volume="${esc(c.id)}">
  <nav class="crumbs"><a href="index.html">Home</a></nav>
  <p class="eyebrow">Volume ${esc(c.id)}</p>
  <h1>${esc(c.title)}</h1>
  ${c.subtitle ? `<p class="lede">${esc(c.subtitle)}</p>` : ''}
  ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
  <div class="vol-progress" data-volume-progress="${esc(c.id)}"></div>
  ${parts.join('\n')}
</main></div>`;
}

function stackIndex(corpus: Corpus, stackHtml: (m: Module) => string) {
  const groups = corpus.stacks
    .map(
      (g) => `<h2 id="${githubSlug(g.title)}">${esc(g.title)} <span class="count">${g.keys.length}</span></h2>
<ul class="cards">${g.keys.map((k) => moduleCard(corpus.modules.get(k)!, stackHtml(corpus.modules.get(k)!))).join('')}</ul>`,
    )
    .join('\n');
  return `<div class="shell single"><main class="volume">
  <nav class="crumbs"><a href="index.html">Home</a></nav>
  <p class="eyebrow">All volumes</p>
  <h1>By stack</h1>
  <p class="lede">All ${corpus.modules.size} builds from every volume, grouped by subject, language and stack.</p>
  ${groups}
</main></div>`;
}

function home(corpus: Corpus, stackHtml: (m: Module) => string) {
  const vols = corpus.volumes
    .map((v) => {
      const keys = v.entries.filter((e) => e.kind === 'module').map((e) => (e as { key: string }).key);
      const first = corpus.modules.get(keys[0])!;
      const last = corpus.modules.get(keys[keys.length - 1])!;
      return `<li class="vol-card"><a href="${volumeFile(v.config.id)}">
  <span class="eyebrow">Volume ${esc(v.config.id)} · ${first.id}–${last.id}</span>
  <span class="card-title">${esc(v.config.title)}</span>
  <span class="muted">${keys.length} modules${v.config.subtitle ? ` · ${esc(v.config.subtitle)}` : ''}</span>
  <span class="vol-progress" data-volume-progress="${esc(v.config.id)}"></span>
</a></li>`;
    })
    .join('');
  const all = [...corpus.modules.values()].map((m) => moduleCard(m, stackHtml(m))).join('');
  const catalog = JSON.stringify(
    Object.fromEntries(corpus.volumes.map((v) => [v.config.id, v.entries.filter((e) => e.kind === 'module').map((e) => (e as { key: string }).key)])),
  );
  return `<div class="shell single"><main class="home">
  <h1>The Gauntlet</h1>
  <p class="lede">${corpus.modules.size} modules across ${corpus.volumes.length} volumes. Read them, then do the work: decisions, research timeboxes, hints, measurements and code. Everything you write stays on this machine.</p>
  <label class="search"><span class="sr">Search modules</span><input type="search" placeholder="Search modules by id, title or stack…" data-search-input></label>
  <ul class="cards search-results" data-search-results hidden>${all}</ul>
  <ul class="vol-grid">${vols}</ul>
  <section class="data-panel" data-widget="data-panel"><h2>Your work</h2></section>
  <script type="application/json" id="catalog">${catalog}</script>
</main></div>`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const corpus = parseCorpus(ROOT);
  let bad = false;
  for (const v of corpus.volumes) {
    const n = v.entries.filter((e) => e.kind === 'module').length;
    if (n !== v.config.expectModules) {
      console.error(`✗ volume ${v.config.id}: ${n} modules, expected ${v.config.expectModules}`);
      bad = true;
    }
  }
  if (process.argv.includes('--report')) {
    for (const v of corpus.volumes) console.log(`${v.config.id}: ${v.entries.filter((e) => e.kind === 'module').length} modules`);
    console.log(`\nSections kept as "extra" (${corpus.unmapped.length}):`);
    for (const u of corpus.unmapped) console.log(`  ${u.key}: ${u.heading}`);
  } else {
    const out = resolve(arg('--out') ?? resolve(ROOT, 'site'));
    const r = build(out, corpus);
    console.log(`Built ${r.modules} modules and ${r.pages} reading pages → ${out}`);
  }
  if (bad) process.exit(1);
}
