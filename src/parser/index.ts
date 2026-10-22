import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { headings, parseModuleHeading, splitVolume } from './split.ts';
import type { Corpus, Manifest, Module, Page, StackGroup, StackRule } from './types.ts';

export function loadManifest(root: string): Manifest {
  return JSON.parse(readFileSync(resolve(root, 'volumes.json'), 'utf8'));
}

export function parseCorpus(root: string, manifest = loadManifest(root)): Corpus {
  const modules = new Map<string, Module>();
  const pages = new Map<string, Page>();
  const volumes = manifest.volumes.map((config) => {
    const src = readFileSync(resolve(root, config.file), 'utf8');
    const r = splitVolume(config, src);
    for (const m of r.modules) {
      if (modules.has(m.key)) throw new Error(`duplicate module key ${m.key}`);
      modules.set(m.key, m);
    }
    for (const p of r.pages) pages.set(p.slug, p);
    return { config, entries: r.entries };
  });

  const unmapped = [...modules.values()].flatMap((m) =>
    m.sections.filter((s) => s.canonical === 'extra').map((s) => ({ key: m.key, heading: s.heading })),
  );

  return { volumes, modules, pages, stacks: parseStacks(root, manifest, modules), unmapped };
}

/** Only the grouping is taken from the by-stack file; content comes from the volumes. */
function parseStacks(root: string, manifest: Manifest, modules: Map<string, Module>): StackGroup[] {
  const cfg = manifest.stackIndex;
  const lines = readFileSync(resolve(root, cfg.file), 'utf8').split(/\r?\n/);
  const groups: StackGroup[] = [];
  for (const h of headings(lines)) {
    if (h.level === cfg.groupLevel && !/^The Gauntlet/.test(h.text)) {
      groups.push({ title: h.text, keys: [] });
    } else if (h.level === cfg.moduleLevel && groups.length) {
      const mh = parseModuleHeading(h.text);
      if (!mh) continue;
      const key = cfg.volumes.map((v) => `${v}-${mh.id}`).find((k) => modules.has(k));
      if (!key) throw new Error(`stack index: ${mh.id} not found in volumes ${cfg.volumes.join(', ')}`);
      groups[groups.length - 1].keys.push(key);
    }
  }
  return classifyRest(groups, cfg.rules ?? [], cfg.fallback, modules);
}

/** Modules the stack file does not cover (volumes III–VI) are placed by rule, in volume order. */
function classifyRest(groups: StackGroup[], rules: StackRule[], fallback: string | undefined, modules: Map<string, Module>): StackGroup[] {
  const placed = new Set(groups.flatMap((g) => g.keys));
  const compiled = rules.map((r) => ({ ...r, re: r.pattern ? new RegExp(r.pattern, 'i') : undefined }));
  const group = (title: string) => groups.find((g) => g.title === title) ?? groups[groups.push({ title, keys: [] }) - 1];
  for (const m of modules.values()) {
    if (placed.has(m.key)) continue;
    const text = `${m.title} · ${m.stack ?? ''}`;
    const rule = compiled.find((r) => (!r.volumes || r.volumes.includes(m.volume)) && (r.re ? r.re.test(text) : !!r.volumes));
    const title = rule?.group ?? fallback;
    if (title) group(title).keys.push(m.key);
  }
  return groups.filter((g) => g.keys.length);
}
