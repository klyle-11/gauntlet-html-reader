# Gauntlet HTML

A local tool that parses the Gauntlet markdown volumes into an interactive HTML workbook, so each module can be worked through in the browser alongside your own code, notes and decisions.

It is entirely web-based: a Node build step writes a static HTML site (about 2 MB, with no framework and no client-side build). That site is the export. Open `site/index.html` from disk, serve it, or copy the folder anywhere.

## Quick start

```sh
npm install          # markdown-it only; the rest are dev tools
npm run build        # docs/ → site/  (or: npm run build -- --out ../my-export)
npm run serve        # http://127.0.0.1:4317/  (optional; file:// works too)
npm test             # module counts, section mapping, link integrity
npm run report       # sections that fell through to "extra"
```

Requires Node 22.18 or newer, which runs the TypeScript sources directly.

## Source documents (`docs/`)

| Volume | File | Module IDs | Notes |
|---|---|---|---|
| I & II | `0 The_Gauntlet_Complete.md` | M1–M46 | Gauntlets I and II combined, in volume order. This is the content source |
| I & II | `The_Gauntlet_By_Stack.md` | M1–M46 | The same I + II content in a different order (grouped by stack). Only its grouping is used, as a second index |
| III | `The_Gauntlet_III.md` | M47–M59 | Systems, networks, clients & craft |
| IV | `The_Gauntlet_IV_Microsoft_Enterprise_Developer.md` | M60–M71 | Uses a different section schema |
| V | `local_first_reader_build_guide_v0_1 (1).md` | RR01–RR13 | "The Reading Room Gauntlet" (ch. 33) sits inside a 34-chapter build guide |
| VI | `THE_GAUNTLET_V.md` | M60–M77 ⚠️ | Marginalia. It was written after V, so it is volume VI. Its own title says "IV", and its IDs collide with volume IV |

The volume number comes from build order, not from the filename or the title inside the file. The parser has to assign volume numbers from a manifest (see below) and must not trust either one.

## Goals

1. **Parse**: split each volume into modules and each module into normalized sections (Story, Ground Floor, Briefing, Trap, Feature, Decision map, Research, Fence, Measure, Hints, Slow walk, Prove it).
2. **Render**: produce one page per module, plus volume and stack indexes. Keep the prose faithful to the source.
3. **Interact**, with everything saved locally:
   - a code editor per module, saved as real files on disk
   - a DSA note per decision-map item (chosen option, reasons, one rejected alternative)
   - research timeboxes with a 25/45-minute timer and a "done when" checkbox
   - progressive hint ladders: Orient → Approach → Near-spoiler, with the near-spoiler gated behind logged attempts
   - acceptance criteria as checkboxes
   - a measure-ritual log for recording numbers, plus a parking lot
4. **Re-parse safely**: editing a source `.md` and rebuilding must never lose your work. Work is keyed by a stable module key, not by position.

## Stack

- **Build** (`src/build.ts`, `src/parser/`, `src/render/`): TypeScript run directly by Node, using `markdown-it` (`html: true` for the `<details>` hint blocks) plus a fence-aware splitter driven by `volumes.json`. Each module and each reading page becomes its own flat `.html` file.
- **Client** (`src/client/app.js`, `app.css`): one dependency-free script that adds the widgets on top of the rendered prose. If an extractor finds nothing, the page still reads correctly.
- **Diagrams**: `mermaid` fences render as diagrams. Mermaid is loaded from a CDN only on the pages that use it, or from `node_modules/mermaid` if you install it (`npm i -D mermaid`) for fully offline use. With neither available, the source is shown instead.
- **Persistence**: always `localStorage`. In Chromium browsers (Chrome, Edge, Arc) you can also pick a **workspace folder** on the home page. Each module is then written as `<folder>/<moduleKey>/notes.json` plus your code files as real files, and on load the newer copy wins. Any browser can **export or import** all work as one JSON file, and each module can download its notes as Markdown.

### Why not Tauri or Electron

Nothing here needs a native shell. The File System Access API covers "real files on disk", and the output is plain HTML. If you later want a desktop window, Tauri can point `frontendDist` at `site/` without changes. The only extra work would be swapping the folder-picker storage for Tauri's fs plugin.

## What the widgets do

| Where | Widget |
|---|---|
| Acceptance criteria, slow walk, prove it | checkboxes |
| Decision map | a DSA note per item: chosen option, reasons, rejected alternative, why not |
| Research targets | a timer button for each `N min` it finds, plus "done when met". The timer follows you across pages, chimes when time is up, and logs the session |
| Hint ladder | rungs reveal one at a time, and the near-spoiler stays locked until you log the attempts it asks for |
| Measure ritual | a dated log of numbers |
| Workspace (bottom of each module) | code files, a parking lot, your own checklist, and notes whose source text changed |

Widget state is keyed by module key plus a hash of the item's text, not by position, so re-parsing after reordering a source never moves a note. If an item's text is edited, its old note is shown under "Notes on text that changed" rather than dropped.

## Layout

```
docs/                  source markdown (read-only input)
volumes.json           manifest: file → volume number, title, ID prefix, heading level, expected count
src/parser/            split → normalize → modules, reading pages, stack groups
src/render/            markdown-it setup (heading ids, cross-references, anchor rewriting) and page templates
src/client/            app.js + app.css, copied into site/assets/
src/build.ts           writes site/
src/serve.ts           tiny static server for site/
test/                  node:test suite
site/                  build output (gitignored)
workspace/             suggested workspace folder (gitignored or committed, your call)
```

## Module keys

Keys are `<volume>-<id>`, for example `I-M1`, `IV-M60`, `V-RR04` and `VI-M60`. The bare `M60` is ambiguous, so it is never used as a key.
