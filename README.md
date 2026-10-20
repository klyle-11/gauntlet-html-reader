# Gauntlet HTML

A local tool that parses the Gauntlet markdown volumes into an interactive HTML workbook, so each module can be worked through in the browser alongside your own code, notes and decisions.

> Status: **pre-scaffold**. Only this README and [`ASSESSMENT.md`](ASSESSMENT.md) exist so far. Read the assessment before you write the parser.

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

1. **Parse**: split each volume into modules and each module into normalized sections (Story, Briefing, Trap, Feature, Decision map, Research, Fence, Measure, Hints, Slow walk, Prove it).
2. **Render**: produce one page per module, plus volume and stack indexes. Keep the prose faithful to the source.
3. **Interact**, with everything saved locally:
   - a code editor per module, saved as real files on disk
   - a DSA note per decision-map item (chosen option, reasons, one rejected alternative)
   - research timeboxes with a 25/45-minute timer and a "done when" checkbox
   - progressive hint ladders: Orient → Approach → Near-spoiler, with the near-spoiler gated behind logged attempts
   - acceptance criteria as checkboxes
   - a measure-ritual log for recording numbers, plus a parking lot
4. **Re-parse safely**: editing a source `.md` and rebuilding must never lose your work. Work is keyed by a stable module key, not by position.

## Proposed stack

- **Node + TypeScript** build step: `markdown-it` (with `html: true` for the `<details>` hint blocks) plus a custom splitter that turns the docs into `modules.json`.
- **Vite** front end. **CodeMirror 6** for code input and **mermaid** for the diagrams in volume V.
- **Persistence**: a small dev-server endpoint that writes to `workspace/<moduleKey>/` (code files and `notes.json`), so the work is plain files you can open in your editor and commit. `localStorage` is used only for UI state.

## Planned layout

```
docs/                  source markdown (read-only input)
volumes.json           manifest: file → volume number, title, ID prefix, schema
src/parser/            split → normalize → emit modules.json
src/app/               Vite UI
workspace/             your code + notes per module (gitignored or committed, your call)
```

## Module keys

Keys are `<volume>-<id>`, for example `I-M1`, `IV-M60`, `V-RR04` and `VI-M60`. The bare `M60` is ambiguous, so it is never used as a key.
