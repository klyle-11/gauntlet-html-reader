import type { Corpus, Module, Page, Volume } from '../parser/types.ts';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const moduleFile = (key: string) => `${key}.html`;
export const pageFile = (slug: string) => `${slug}.html`;
export const volumeFile = (id: string) => `vol-${id}.html`;

const SECTION_LABEL: Record<string, string> = {
  story: 'Story',
  lead: '',
};

interface LayoutOpts {
  title: string;
  body: string;
  corpus: Corpus;
  volume?: string;
  bodyAttrs?: string;
  mermaid?: boolean;
  mermaidSrc: string;
}

export function layout(o: LayoutOpts): string {
  const nav = o.corpus.volumes
    .map((v) => `<a href="${volumeFile(v.config.id)}"${o.volume === v.config.id ? ' aria-current="page"' : ''}>${esc(v.config.id)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)} · Gauntlet</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="assets/app.css">
<script>try{var t=localStorage.getItem('gauntlet:theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head>
<body ${o.bodyAttrs ?? ''}>
<header class="topbar">
  <a class="brand" href="index.html">Gauntlet</a>
  <nav class="vols" aria-label="Volumes">${nav}<a href="stacks.html">By stack</a></nav>
  <span class="spacer"></span>
  <button class="ws-status" type="button" data-action="workspace" title="Where your work is saved">Browser storage</button>
  <button class="icon" type="button" data-action="theme" title="Toggle theme" aria-label="Toggle theme">◐</button>
</header>
${o.body}
<div class="timerbar" hidden></div>
<script src="assets/app.js"></script>
${o.mermaid ? `<script src="${o.mermaidSrc}" defer onload="window.renderMermaid&&window.renderMermaid()"></script>` : ''}
</body>
</html>
`;
}

export function chips(m: Module): string {
  const out = [`<span class="chip id">${esc(m.id)}</span>`];
  if (m.size) out.push(`<span class="chip size" title="Size">${esc(m.size)}</span>`);
  if (m.meta) out.push(`<span class="chip">${esc(m.meta)}</span>`);
  return out.join('');
}

export function sectionId(canonical: string, heading: string, seen: Set<string>): string {
  let id = canonical === 'extra' ? `x-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : canonical;
  while (seen.has(id)) id += '-2';
  seen.add(id);
  return id;
}

export interface ModuleView {
  module: Module;
  volume: Volume;
  sectionsHtml: { id: string; canonical: string; heading: string; html: string; steps: { id: string; label: string }[] }[];
  stackHtml?: string;
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}

export function moduleBody(v: ModuleView): string {
  const m = v.module;
  const toc = v.sectionsHtml
    .filter((s) => s.heading || SECTION_LABEL[s.canonical])
    .map((s) => {
      const label = s.canonical === 'groundfloor' ? 'Ground Floor' : s.heading || SECTION_LABEL[s.canonical];
      const steps = s.steps.length
        ? `<ol class="toc-steps">${s.steps.map((st) => `<li><a href="#${st.id}">${esc(st.label)}</a></li>`).join('')}</ol>`
        : '';
      return `<li><a href="#${s.id}" title="${esc(s.heading)}">${esc(label)}</a>${steps}</li>`;
    })
    .join('');
  const secs = v.sectionsHtml
    .map((s) => {
      const h = s.heading || SECTION_LABEL[s.canonical];
      return `<section class="sec sec-${s.canonical}" id="${s.id}" data-section="${s.id}" data-canonical="${s.canonical}">
${h ? `<h2>${esc(h)}</h2>` : ''}
${s.html}
</section>`;
    })
    .join('\n');
  return `<div class="shell">
<aside class="toc" aria-label="On this page">
  <p class="toc-title">${esc(m.id)}</p>
  <ol>${toc}<li class="toc-ws"><a href="#workspace">Workspace</a></li></ol>
  <div class="progress" data-progress></div>
</aside>
<main class="module" data-module="${esc(m.key)}" data-title="${esc(`${m.id} — ${m.title}`)}">
  <nav class="crumbs"><a href="index.html">Home</a> / <a href="${volumeFile(v.volume.config.id)}">${esc(v.volume.config.title)}</a></nav>
  <header class="mod-head">
    <div class="chips">${chips(m)}<span class="chip key" title="Your work is stored under this key">${esc(m.key)}</span></div>
    <h1>${esc(m.title)}</h1>
    ${v.stackHtml ? `<p class="stack">${v.stackHtml}</p>` : ''}
  </header>
${secs}
<section class="sec workspace" id="workspace" data-section="workspace">
  <h2>Workspace</h2>
  <p class="muted">Your code, parking lot and a free-form checklist for ${esc(m.key)}. Saved in this browser, and to your workspace folder when one is connected.</p>
  <div data-widget="workspace"></div>
</section>
${pager(v.prev, v.next)}
</main>
</div>`;
}

export function pager(prev?: { href: string; label: string }, next?: { href: string; label: string }): string {
  return `<nav class="pager">
  ${prev ? `<a class="prev" href="${prev.href}"><span>Previous</span>${esc(prev.label)}</a>` : '<span></span>'}
  ${next ? `<a class="next" href="${next.href}"><span>Next</span>${esc(next.label)}</a>` : '<span></span>'}
</nav>`;
}

export function pageBody(p: Page, volume: Volume, html: string, prev?: { href: string; label: string }, next?: { href: string; label: string }): string {
  return `<div class="shell single">
<main class="reading" data-page="${esc(p.slug)}">
  <nav class="crumbs"><a href="index.html">Home</a> / <a href="${volumeFile(volume.config.id)}">${esc(volume.config.title)}</a></nav>
  <h1>${esc(p.title)}</h1>
  <div class="prose">${html}</div>
  ${pager(prev, next)}
</main>
</div>`;
}

export function moduleCard(m: Module, stackHtml: string): string {
  return `<li class="card" data-key="${esc(m.key)}" data-search="${esc(`${m.key} ${m.id} ${m.title} ${m.stack ?? ''}`.toLowerCase())}">
  <a href="${moduleFile(m.key)}">
    <span class="chips">${chips(m)}</span>
    <span class="card-title">${esc(m.title)}</span>
    ${stackHtml ? `<span class="card-stack">${stackHtml}</span>` : ''}
    <span class="card-progress" data-card-progress></span>
  </a>
</li>`;
}
