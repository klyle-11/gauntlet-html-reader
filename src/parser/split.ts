import type { Canonical, Entry, Module, Page, Section, VolumeConfig } from './types.ts';

export interface Heading {
  line: number;
  level: number;
  text: string;
}

/** Headings outside fenced code blocks. `line` is 0-based. */
export function headings(lines: string[]): Heading[] {
  const out: Heading[] = [];
  let fence: string | null = null;
  lines.forEach((raw, line) => {
    const f = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const h = raw.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
    if (h) out.push({ line, level: h[1].length, text: h[2] });
  });
  return out;
}

/** GitHub-style heading slug, matching the links the sources already use. */
export function githubSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

const MODULE_RE = /^(M\d+|RR\d+) — (.+)$/;
const SIZE_WORDS: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  'extra large': 'XL',
  'medium to large': 'M–L',
  'small to medium': 'S–M',
};

export function normalizeSize(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().replace(/^\(|\)$/g, '');
  if (/^(XS|S|M|L|XL|XXL)([–-](S|M|L|XL))?$/.test(s)) return s.replace('-', '–');
  return SIZE_WORDS[s.toLowerCase()];
}

export function parseModuleHeading(text: string) {
  const m = text.match(MODULE_RE);
  if (!m) return null;
  const [title, ...rest] = m[2].split(' · ');
  let size: string | undefined;
  const stack: string[] = [];
  for (const part of rest) {
    const n = normalizeSize(part);
    if (n) size = n;
    else stack.push(part.trim());
  }
  return { id: m[1], title: title.trim(), stack: stack.join(' · ') || undefined, size };
}

const ALIASES: [Canonical, string[]][] = [
  ['story', ['story']],
  ['briefing', ['briefing']],
  ['trap', ['the trap', 'trap']],
  ['feature', ['the feature', 'feature', 'build', 'the build']],
  ['decisions', ['decision map', 'decisions']],
  ['research', ['research targets', 'research targets and stops', 'research stop', 'research stops']],
  ['fence', ['out of scope (fence)', 'out of scope', 'fence']],
  ['measure', ['measure ritual', 'measure']],
  ['hints', ['hints ladder', 'hint ladder']],
  ['slowwalk', ['the slow walk', 'slow walk']],
  ['prove', ['prove it — the three rooms', 'prove it in three rooms', 'prove it']],
];
const ALIAS_MAP = new Map<string, Canonical>();
for (const [c, names] of ALIASES) for (const n of names) ALIAS_MAP.set(n, c);

export function canonicalSection(heading: string): Canonical {
  const key = heading.toLowerCase().replace(/\s+/g, ' ').replace(/[–-]/g, '—').trim();
  return ALIAS_MAP.get(key) ?? ALIAS_MAP.get(key.replace(/\s—\s/g, ' — ')) ?? 'extra';
}

const ANCHOR_LINE = /^\s*<a id="([^"]+)"><\/a>\s*$/;
const SKIP_PAGES = /^(table of )?contents$/i;

/** Drop trailing blank lines and thematic breaks that only separate modules. */
function trimBody(lines: string[]): string {
  const out = [...lines];
  while (out.length && (/^\s*$/.test(out[out.length - 1]) || /^\s*(---+|\*\*\*+)\s*$/.test(out[out.length - 1])))
    out.pop();
  while (out.length && /^\s*$/.test(out[0])) out.shift();
  return out.join('\n');
}

function splitSections(lines: string[], level: number): { lead: string[]; sections: { heading: string; body: string[] }[] } {
  const hs = headings(lines).filter((h) => h.level === level);
  const lead = lines.slice(0, hs[0]?.line ?? lines.length);
  const sections = hs.map((h, i) => ({
    heading: h.text,
    body: lines.slice(h.line + 1, hs[i + 1]?.line ?? lines.length),
  }));
  return { lead, sections };
}

/** IV puts size and stack on a bold line under the title: `**C# · .NET · Medium · ~3 protected blocks**`. */
function takeMetaLine(lead: string[]) {
  const i = lead.findIndex((l) => l.trim() !== '');
  if (i < 0) return null;
  const m = lead[i].trim().match(/^\*\*([^*]+·[^*]+)\*\*$/);
  if (!m) return null;
  const parts = m[1].split('·').map((s) => s.trim());
  let size: string | undefined;
  const stack: string[] = [];
  const rest: string[] = [];
  for (const p of parts) {
    const n = normalizeSize(p);
    if (n && !size) size = n;
    else if (/blocks?$/.test(p)) rest.push(p);
    else stack.push(p);
  }
  lead.splice(i, 1);
  return { size, stack: stack.join(' · '), meta: rest.join(' · ') || undefined };
}

export interface SplitResult {
  entries: Entry[];
  modules: Module[];
  pages: Page[];
}

/**
 * Split one volume's markdown into modules, reading pages and group headings.
 * A chunk starts at every heading at or above the module level; chunks whose
 * heading is a module become modules, the rest become pages (at the module
 * level) or groups (above it, e.g. `# PART I`).
 */
export function splitVolume(cfg: VolumeConfig, source: string): SplitResult {
  let lines = source.split(/\r?\n/);
  let offset = 0;
  if (cfg.from) {
    const i = lines.findIndex((l) => l.trim() === cfg.from);
    if (i < 0) throw new Error(`${cfg.id}: start heading not found: ${cfg.from}`);
    offset = i;
    lines = lines.slice(i);
  }
  if (cfg.to) {
    const i = lines.findIndex((l) => l.trim() === cfg.to);
    if (i < 0) throw new Error(`${cfg.id}: end heading not found: ${cfg.to}`);
    lines = lines.slice(0, i);
  }

  const L = cfg.moduleLevel;
  const cuts = headings(lines).filter((h) => h.level <= L);
  if (!cuts.length || cuts[0].line > 0) cuts.unshift({ line: -1, level: 0, text: '' });

  const entries: Entry[] = [];
  const modules: Module[] = [];
  const pages: Page[] = [];
  let pendingAnchors: string[] = [];
  let pageNo = 0;

  cuts.forEach((h, i) => {
    let body = lines.slice(h.line + 1, cuts[i + 1]?.line ?? lines.length);
    // `<a id="m61"></a>` lines belong to the heading that follows them.
    const anchors = pendingAnchors;
    pendingAnchors = [];
    while (body.length && (ANCHOR_LINE.test(body[body.length - 1]) || /^\s*$/.test(body[body.length - 1]) || /^\s*---+\s*$/.test(body[body.length - 1]))) {
      const a = body[body.length - 1].match(ANCHOR_LINE);
      if (a) pendingAnchors.push(a[1]);
      body = body.slice(0, -1);
    }
    if (h.text) anchors.push(githubSlug(h.text));
    const sourceLine = offset + h.line + 2;

    const mh = h.level === L ? parseModuleHeading(h.text) : null;
    if (mh) {
      if (!mh.id.startsWith(cfg.idPrefix)) throw new Error(`${cfg.id}: unexpected module id ${mh.id}`);
      const { lead, sections } = splitSections(body, L + 1);
      const meta = takeMetaLine(lead);
      // Anything inside the module can be linked to as well (e.g. the TOC in V).
      for (const sh of headings(body)) anchors.push(githubSlug(sh.text));
      const out: Section[] = [];
      const leadMd = trimBody(lead);
      if (leadMd) out.push({ canonical: /^>\s*\*\*Story\.?\*\*/m.test(leadMd) ? 'story' : 'lead', heading: '', md: leadMd });
      for (const s of sections) out.push({ canonical: canonicalSection(s.heading), heading: s.heading, md: trimBody(s.body) });
      const key = `${cfg.id}-${mh.id}`;
      modules.push({
        key,
        volume: cfg.id,
        id: mh.id,
        title: mh.title,
        stack: mh.stack ?? (meta?.stack || undefined),
        size: mh.size ?? meta?.size,
        meta: meta?.meta,
        anchors,
        sections: out,
        sourceLine,
      });
      entries.push({ kind: 'module', key });
      return;
    }

    const md = trimBody(body);
    if (h.level > 0 && h.level < L) {
      entries.push({ kind: 'group', title: h.text, md });
      // Group intros are shown on the volume index; anchors to them land there.
      return;
    }
    if (SKIP_PAGES.test(h.text.trim())) return;
    if (!md && !h.text) return;
    // The title chunk of a level-1 volume holds its whole front matter.
    const title = !h.text || (L === 1 && !modules.length && !pages.length) ? 'Introduction' : h.text;
    const slug = pageSlug(cfg.id, ++pageNo, title);
    pages.push({ slug, volume: cfg.id, title, md, anchors, sourceLine });
    entries.push({ kind: 'page', slug });
  });

  // A group with no modules under it (an epilogue, an appendix) reads as a page.
  const finalEntries = entries.flatMap((e, i): Entry[] => {
    if (e.kind !== 'group') return [e];
    const next = entries.slice(i + 1).find((n) => n.kind !== 'page');
    if (next?.kind === 'module') return [e];
    if (!e.md) return [];
    const slug = pageSlug(cfg.id, ++pageNo, e.title);
    pages.push({ slug, volume: cfg.id, title: e.title, md: e.md, anchors: [githubSlug(e.title)], sourceLine: 0 });
    return [{ kind: 'page', slug }];
  });

  return { entries: finalEntries, modules, pages };
}

function pageSlug(volume: string, n: number, title: string): string {
  const words = githubSlug(title).replace(/-+/g, '-').slice(0, 40).replace(/-$/, '');
  return `${volume}-p${String(n).padStart(2, '0')}-${words}`;
}
