import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { githubSlug } from '../parser/split.ts';

export interface LinkContext {
  /** Resolve `M12` / `RR04` mentioned in the text to a page href, or null. */
  moduleHref(id: string): string | null;
  /** Resolve a `#fragment` link from the source to a page href, or null. */
  anchorHref(fragment: string): string | null;
  /** Resolve "section N" (volume V's chapters) to a page href, or null. */
  sectionHref?(n: number): string | null;
  /** The page being rendered, so it never links to itself. */
  self?: string;
}

const XREF = /\b(M\d{1,2}|RR\d{2})\b|\b([Ss]ections? )(\d{1,2})\b/g;

export function createRenderer() {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

  // Stable heading ids, matching the GitHub slugs the sources link to.
  md.core.ruler.push('heading_ids', (state) => {
    const seen = new Map<string, number>();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_open') continue;
      const text = tokens[i + 1].content;
      let id = githubSlug(text);
      const n = seen.get(id) ?? 0;
      seen.set(id, n + 1);
      if (n) id = `${id}-${n}`;
      tokens[i].attrSet('id', id);
    }
  });

  md.core.ruler.push('xrefs', (state) => {
    const ctx = state.env as LinkContext | undefined;
    if (!ctx?.moduleHref) return;
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      const out: Token[] = [];
      let inLink = 0;
      for (const t of block.children) {
        if (t.type === 'link_open') {
          inLink++;
          const href = t.attrGet('href') ?? '';
          if (href.startsWith('#')) {
            const to = ctx.anchorHref(decodeURIComponent(href.slice(1)));
            if (to) t.attrSet('href', to);
          }
        }
        if (t.type === 'link_close') inLink--;
        if (t.type !== 'text' || inLink) {
          out.push(t);
          continue;
        }
        out.push(...linkify(t, ctx, state.Token));
      }
      block.children = out;
    }
  });

  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const t = tokens[idx];
    if (t.info.trim() === 'mermaid') return `<pre class="mermaid">${md.utils.escapeHtml(t.content)}</pre>\n`;
    return fence(tokens, idx, opts, env, self);
  };

  return {
    render(src: string, ctx?: LinkContext): string {
      return md.render(src, ctx);
    },
    renderInline(src: string, ctx?: LinkContext): string {
      return md.renderInline(src, ctx);
    },
  };
}

function linkify(t: Token, ctx: LinkContext, TokenCtor: typeof Token): Token[] {
  const text = t.content;
  const out: Token[] = [];
  let last = 0;
  const push = (s: string) => {
    if (!s) return;
    const n = new TokenCtor('text', '', 0);
    n.content = s;
    out.push(n);
  };
  const link = (href: string, label: string, cls: string) => {
    const open = new TokenCtor('link_open', 'a', 1);
    open.attrs = [['href', href], ['class', cls]];
    out.push(open);
    push(label);
    out.push(new TokenCtor('link_close', 'a', -1));
  };
  for (const m of text.matchAll(XREF)) {
    const href = m[1] ? ctx.moduleHref(m[1]) : ctx.sectionHref?.(Number(m[3])) ?? null;
    if (!href || href === ctx.self) continue;
    push(text.slice(last, m.index));
    if (m[1]) link(href, m[1], 'xref');
    else {
      push(m[2]);
      link(href, m[3], 'xref');
    }
    last = m.index! + m[0].length;
  }
  if (!out.length) return [t];
  push(text.slice(last));
  return out;
}
