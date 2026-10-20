# Assessment: parsing the Gauntlet docs

This assessment comes from surveying all six files in `docs/` (heading structure, section names, markdown features, and duplicate content).

## 1. Volume map and what's wrong with the labels

| Vol | File | IDs | Module heading | Section heading | Problems |
|---|---|---|---|---|---|
| I+II | `0 The_Gauntlet_Complete.md` | M1–M46 | `##` | `###` | Also contains `#` volume and `# PART` wrappers and a repeated "Table of contents" |
| I+II | `The_Gauntlet_By_Stack.md` | M1–M46 | `##` | `###` | Same content, different order; `#` headings are stack groups |
| III | `The_Gauntlet_III.md` | M47–M59 | `#` | `##` | Line 1 is blank; the title is on line 2 |
| IV | `…_IV_Microsoft_Enterprise_Developer.md` | M60–M71 | `#` | `##` | Different section schema; titles have no `·` metadata |
| V | `local_first_reader_build_guide_v0_1 (1).md` | RR01–RR13 | `##` | `###` | Modules sit in chapter 33 of a 34-chapter guide; the order in the file is not the ID order |
| VI | `THE_GAUNTLET_V.md` | M60–M77 | `#` | `##` | Its own title says "Gauntlet IV"; **its IDs collide with IV's M60–M71** |

**Decision:** a hand-written `volumes.json` manifest is the source of truth for volume number, title, ID prefix and schema. Module keys are namespaced (`VI-M60` and `IV-M60` are different modules). Source files are never edited to fix labels.

**Complete vs By Stack:** I compared M1, M15 and M33 and they are byte-identical. M46 differs by about 13 lines at the tail, almost certainly because the volume ends there and trailing material gets attached to the last module (to confirm). Parse `Complete` for content. From `By_Stack`, take only the mapping from stack group to module ID.

## 2. Module heading formats

```
## M1 — One Honest Endpoint · Java Spring Boot → React · (M)          I/II
# M47 — The Portfolio That Explains Itself · Next.js + Electron … · (XL)   III, VI
# M60 — Stop Writing Java in C#                                        IV (title only)
## RR01 — One Item Across the Room · Node.js, TypeScript, … · Small    V
```

One regex covers all of them: `^(#{1,2}) (M\d+|RR\d+) — (.+?)(?: · (.+?))?(?: · \(?([^)]+)\)?)?$`. Normalize the size to `S | M | L | XL` (`Small`→S, `Medium to Large`→`M–L`).

A module ends at the next module heading or at any heading of the same or higher level that is not a module (for example V's `## 34. Choosing the next hint…`, or I/II's `# PART II`).

## 3. Section names need a normalization table

| Canonical | I/II | III / VI | IV | V (RR) |
|---|---|---|---|---|
| story | blockquote `> **Story.**` | blockquote | `## Story` | `### Story` |
| briefing | Briefing | Briefing | — | Briefing |
| trap | The trap | The trap | Trap | Trap |
| feature | The feature | The feature | Build | Feature |
| decisions | Decision map | Decision map | Decisions | Decision map |
| research | Research targets | Research targets | Research targets and stops / Research stop | Research targets |
| fence | Out of scope (fence) | Out of scope | — | Fence |
| measure | Measure ritual | Measure ritual | Measure | Measure ritual |
| hints | Hints ladder | Hint ladder | — | Hint ladder |
| slowwalk | The slow walk | The slow walk | — | Slow walk |
| prove | Prove it — the three rooms | Prove it — the three rooms | Prove it in three rooms | Prove it |
| *(extra)* | — | — | Concept translation, Runtime walk, … | — |

Unknown section names fall through as `extra` sections and are rendered in their original order. A section is never dropped.

## 4. Interactivity: what's structured enough to extract

| Feature | Structured in | Prose only in | Approach |
|---|---|---|---|
| Acceptance criteria → checkboxes | I/II, III, VI (bullet list inside the Story blockquote) | IV, V | Extract the list items; where there is no list, show a free-form checklist instead |
| Decision map → DSA note per item | I/II, III, VI (numbered list, `**bold title**`) | IV (partly), V (one paragraph) | One note per numbered item; a single note for prose |
| Research timeboxes | I/II (`— **25 min.**`), VI (`— 25 min.**` + `**Done when:**`) | V ("Spend up to 25 minutes…") | Regex for `(\d+) min`; a timer button on each item |
| Hint ladder | I/II, III, VI: `<details><summary>` with Orient / Approach / Near-spoiler | V: "First hint / Second hint / Third hint" prose; IV: none | Post-process the `<details>` HTML into steps; leave V's prose hints as plain text |
| Diagrams | V only (`mermaid` fences) | — | Render client-side with mermaid |
| Tables / code | IV (3 tables, 6 fences), V (17 tables, 18 fences) | — | Standard markdown-it |

**Rule:** build the interactive widgets *on top of* faithfully rendered prose. Never replace the source text with an extracted version. If an extractor finds nothing, the module still reads correctly.

## 5. Risks

1. **ID collision (IV vs VI).** Handled by namespaced keys. Cross-references inside the text (for example "see M63") are resolved within the module's own volume first.
2. **Cross-references:** text like "M2's job", "RR11" or "section 4" is worth linking, but only after the core parse works.
3. **V is a guide, not just modules.** Chapters 1–32 and 34 are explanatory reading that the RR modules point back to ("Read sections 3 and 4"). Render them as V's reading pages and link `section N` references to them.
4. **Re-parse stability.** Workspace data is keyed by module key + canonical section + item index. If the source reorders decision items, notes can end up on the wrong item. Store the item's title text alongside the index and warn on mismatch.
5. **Raw HTML (`<details>`).** It needs `html: true`; the sources are your own files, so this is acceptable. Watch for inline `` `<br>` `` in code spans in VI. It's harmless in code spans, but don't sanitize it away.
6. **Filenames contain spaces and `(1)`.** The manifest refers to them by exact path.

## 6. Suggested build order

1. `volumes.json` + splitter → `modules.json`, with a test that asserts module counts: 46 / 13 / 12 / 13 / 18.
2. Section normalization + a report listing every unmapped section name.
3. Static render: volume index, stack index, module pages.
4. Workspace persistence (dev-server endpoint → `workspace/`).
5. Widgets, in this order: code editor, acceptance checkboxes, DSA notes, hint ladder, research timer, measure log.
6. Cross-reference linking.
