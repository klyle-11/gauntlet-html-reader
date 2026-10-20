# The Gauntlet IV — Marginalia: Read, Mark, Remember

## Eighteen builds that add up to a portable, hostile-input-proof, memory-frugal reading engine — and a light, social, attention-friendly reader on top of it

This volume continues the numbering from *The Gauntlet III*. It assumes the same operating manual:

> **You do all implementation yourself. This file gives you the problem, the questions, the tradeoffs, the fences, and the proof — not the implementation.**

Volume IV is one system rather than thirteen separate ones. Every module is a piece of a single product — a PDF/EPUB engine that runs natively, in the browser, and eventually on a microcontroller, plus a mobile-first reader where highlights, notes and links between them are the point. Built in order, the modules compose; built à la carte, each still stands alone.

The center of gravity is again **boundaries**, this time inside one product:

- bytes vs text, and text vs geometry,
- the engine vs every host that calls it,
- the worker vs the main thread,
- the browser's selection vs yours,
- what is drawn vs what exists,
- local truth vs the cloud mirror,
- a crash vs a recovery,
- a desktop browser vs 8 MB of PSRAM,
- reading vs attention,
- private notes vs social reading.

The anti-rabbit-hole protocol still applies unchanged: **25-minute default research boxes, 45-minute deep boxes, explicit done-whens, one-line parking-lot entries, and hard out-of-scope fences.** If a research thread does not change a decision you must make in the current module, park it.

<a id="fences-volume-iv"></a>
## Fences for this volume

- **Documents you own or that are in the public domain.** Test corpora are your own files, public-domain books, and fixtures you generate.
- **No DRM removal.** The engine *detects* encrypted publications and refuses them politely. Recognizing DRM is in scope; circumventing it is not.
- **Books never leave the device unless the user explicitly backs them up**, and never into a shared space. Social features (M73) share short quotes and notes, not files.
- **Notes are private by default.** Every path that could expose a note to another person requires an explicit action by the note's author.
- **Hostile-input work targets your own parser.** Fuzzing and mutation testing are defensive: you are proving your code survives strangers' files, not attacking anyone else's.

> **A file the user opened is hostile until proven bounded; a note the user wrote is private until they say otherwise.**

---

## Table of contents

### Orientation

- [Fences for this volume](#fences-volume-iv)
- [How to run this volume](#how-to-run-volume-iv)

### Modules

**The engine**
- [M60 — The Text Is the Contract · text projection, units & offsets · (M)](#m60)
- [M61 — The Zip That Fights Back · a bounded ZIP/EPUB container reader · (M)](#m61)
- [M62 — Sanitize by Rebuilding · XHTML allow-list, CSS, shadow-DOM rendering · (L)](#m62)
- [M63 — Where Is That Letter? · PDF content streams, fonts & per-glyph geometry · (XL)](#m63)
- [M64 — Anchors That Survive Editions · multi-selector anchoring & fuzzy re-attachment · (L)](#m64)
- [M65 — Pictures of Words · an OCR pipeline in workers · (L)](#m65)
- [M66 — One Engine, Every Host · JSON RPC, C ABI, WASM, Python · (L)](#m66)
- [M67 — A Grammar Small Enough to Trust · note links shared by every host · (M)](#m67)

**The reader**
- [M68 — Your Selection, Not the OS's · custom selection with handles on touch · (L)](#m68)
- [M69 — Paint Only What Is Seen · virtualization, budgets & chapter windows · (L)](#m69)
- [M70 — Notes That Outlive the Tab · IndexedDB, revisions, tombstones & sync · (L)](#m70)
- [M71 — Nothing Takes the App Down · error containment & recovery · (M)](#m71)

**People**
- [M72 — Reading for Attention · focus mode, front matter & calm controls · (M)](#m72)
- [M73 — Longform, Bite-Sized, Together · social reading without the attention economy · (L)](#m73)

**Proof and reach**
- [M74 — Hostile Inputs, Measured · fuzzing, properties, differentials & heap checks · (M)](#m74)
- [M75 — The Library on a Raspberry Pi 5 · native engine, kiosk & home server · (L)](#m75)
- [M76 — A Book in 8 MB · an ESP32-S3 e-ink reader with synced notes · (XL)](#m76)
- [M77 — Ship It Small · split bundles, strict CSP & publishing · (M)](#m77)

### Reference and sequencing

- [Source shelf for Volume IV](#source-shelf-volume-iv)
- [Campaign ordering suggestions](#campaign-ordering-volume-iv)
- [Volume IV closing test](#closing-test-volume-iv)

---

<a id="how-to-run-volume-iv"></a>
## How to run this volume

Each module uses the same eleven-part shape as the earlier volumes: **Story · Briefing · Trap · Feature · Decision map · Research targets · Fence · Measure ritual · Hint ladder · Slow walk · Prove it.**

Keep two extra notebook pages per module.

**Boundary Map** (as in Volume III). Draw every process, worker, thread, file, store, host language, device and network involved. Box what you own; box differently what you merely consume. Mark every place bytes, text offsets or user data cross a boundary — and write the *unit* on each arrow (bytes, chars, UTF-16 units, pixels, PDF points, CSS px).

**Budget Sheet** (new). Before code, write the budget the module must live inside: bytes per character, maximum resident bytes, worst-case operations per input byte, frames per second, milliseconds to first paint, megabytes of PSRAM. A budget you did not write down cannot be violated — which is exactly the problem.

> **If you cannot state the budget, you are not ready to code the loop.**

Each module ends with **Compare after**: the files in this repository (`claude/marginalia`) that solve the same problem one way. Open them only after your own attempt passes its Prove-it, the way you would read someone else's solution to a puzzle you already solved. Disagreeing with them is allowed; being able to say *why* is the point.

---

<a id="m60"></a>
# M60 — The Text Is the Contract · text projection, units & offsets · (M)

> **Story.** As an engine builder, I want every page and chapter to have one canonical text projection with an explicit offset unit, so that selection, search, anchors, OCR and notes all speak the same coordinates on every platform.
>
> **MVP.** A `Document` abstraction with ordered *units* (PDF pages, EPUB spine items); `unit_text(i)` returns the unit's text and, for fixed layouts, one box per character; offset maps convert between Unicode scalar values, UTF-16 code units and UTF-8 bytes; a CLI prints the projection of a PDF page and an EPUB chapter.
>
> **Acceptance criteria.**
> - Two runs over the same file produce byte-identical projections.
> - Offsets round-trip losslessly between chars, UTF-16 and UTF-8 for text with emoji, combining marks and right-to-left script.
> - A JavaScript string index into a chapter maps to the same stored offset Rust computes.
> - Your whitespace policy is written down in one paragraph, and every component follows it.
> - Stored offsets have exactly one unit; conversion happens only at boundaries.

## Briefing

Everything downstream depends on a decision you make here: **what is "the text" of a page?** A PDF page has glyph runs in painting order; an EPUB chapter has DOM text nodes; an OCR'd scan has recognized lines. If each feature derives its own idea of the text, highlights drift, search lands one word off, and a note made on a phone resolves differently on a laptop.

So choose a **projection** — a deterministic function from a unit to a string — and treat it as a contract. For EPUB, the rendered DOM must reproduce it exactly (M62). For PDF, geometry indexes into it (M63). For OCR, the recognized layer *becomes* a projection (M65).

Offsets are the other half. Rust strings are UTF-8, JavaScript and Swift `NSString` index UTF-16, Python indexes code points. Pick the unit you store, and convert at the edge with a precomputed map.

The center of gravity is **one text, one unit, many hosts**.

## The trap

1. **Storing whatever the browser gave you.** UTF-16 offsets saved from JavaScript disagree with Python and Rust by one per emoji.
2. **Normalizing in one place only.** Collapse whitespace in the engine but not in the rendered DOM, and anchors drift a few characters per paragraph.
3. **"The text is `textContent`."** Hidden elements, `<br>`, soft hyphens and entities all make that a different string from the one you meant.

## The feature

- A `Document` trait/interface: info, units, `unit_text`, sections.
- A text projection for PDF pages (from your M63 interpreter or a stub) and EPUB chapters (from M62).
- An offset map type: build once per unit, convert in O(1) or O(log n).
- A CLI: `text <file> [unit]`, `offsets <file> <unit> <utf16-index>`.

## Decision map

1. **Stored offset unit.** Chars · UTF-16 units · UTF-8 bytes.
   *Forcing:* which hosts will read stored anchors in five years?
2. **Whitespace policy.** Preserve · collapse per block · collapse globally.
   *Forcing:* can the renderer reproduce exactly the same string?
3. **Unit granularity.** Page · chapter · section.
4. **Ligatures and soft hyphens.** Keep in the projection · normalize for search only.
5. **Geometry attachment.** Per char · per glyph · per line.
6. **Where normalization lives.** Engine only — or explain why not.

## Research targets

- **Text encodings and JavaScript strings — 25 min.**
  **Done when:** you can explain why `"😀".length === 2` and what that does to a stored offset.
- **Grapheme clusters (UAX #29) — 25 min.**
  **Done when:** you can say why selection should snap to graphemes even if offsets count scalar values.
- **PDF text extraction basics — 45 min (deep).**
  **Done when:** you can explain why painting order is not reading order.
- **DOM text-node model — 25 min.**
  **Done when:** you can predict the text nodes produced by a paragraph containing `<em>`, `<br/>` and an entity.

## Out of scope

Bidirectional layout, vertical text, every Unicode normalization form, language detection, hyphenation dictionaries.

## Measure ritual

Assemble ten documents: emoji, combining marks, Arabic or Hebrew, ligatures, soft hyphens, tables.

**Numbers:** offset round-trip mismatches (must be **0**), bytes per character of your projection plus geometry, and the time to build an offset map for the largest unit.

## Hint ladder

<details><summary>My highlights drift by one character per emoji</summary>

**Orient:** two offset units are mixing somewhere in the pipeline.

**Approach:** list every boundary where an offset crosses (engine → JSON → worker → main thread → DOM → storage) and write the unit on each arrow. Convert exactly once per boundary using a precomputed map (prefix sums of UTF-16 lengths over the unit's chars). An offset that has been converted twice is the bug.

</details>

## The slow walk

1. Write the projection rules for PDF and EPUB in prose.
   **Check:** a friend can apply them by hand to a small paragraph.
2. Implement the `Document` interface with a fake in-memory document.
3. Build the offset map and its round-trip tests first.
   **Check:** property test over random strings passes.
4. Add EPUB projection (stub M62 if needed).
5. Add PDF projection (stub M63 if needed).
6. Build the CLI and run the ten-document corpus.
7. Write the one-paragraph whitespace contract into your README.

## Prove it — the three rooms

- **Interview:** explain why the engine stores char offsets and converts to UTF-16 only at the JavaScript boundary.
- **Design review:** a peer wants to store DOM `Range` offsets directly. Show the Python host that disagrees.
- **Meetup:** "Every feature in my reader agrees on what 'the text' is — so a highlight made on a phone lands on the same letters on a laptop."

**Reach-backs:** M20 parser thinking · M27 selection/clipboard.
**Compare after:** `crates/core/src/text.rs`, `crates/core/src/document.rs`, `crates/marginalia/src/rpc.rs` (`OffsetEncoding`).

---

<a id="m61"></a>
# M61 — The Zip That Fights Back · a bounded ZIP/EPUB container reader · (M)

> **Story.** As an engine builder, I want an EPUB container reader that opens hostile archives without ever exceeding a memory budget, so that a 40 KB zip bomb or a `../../` path cannot hurt the host.
>
> **MVP.** Parse the ZIP central directory; inflate one entry on demand with per-entry and total caps; verify CRCs; normalize paths before lookup; read `META-INF/container.xml` → OPF → manifest, spine and navigation; detect DRM through `encryption.xml` and refuse.
>
> **Acceptance criteria.**
> - A zip bomb is refused with a clear error, and peak memory stays within your budget while refusing it.
> - Path traversal entries are rejected.
> - Truncated or corrupted archives return errors, never panics.
> - A DRM-protected book reports `encrypted`.
> - A 300-entry EPUB opens without inflating any chapter.

## Briefing

An EPUB is a ZIP archive containing XML: a container file pointing at a package document (OPF), which lists the manifest and the spine (reading order), and a navigation document. Libraries exist for all of it. Writing a small reader yourself teaches the lesson that matters for the rest of the volume: **every number in an untrusted file is a claim, not a fact.**

The central directory says how big an entry is. The local header may disagree. The inflated stream decides for itself. The XML may try to expand entities into gigabytes.

The center of gravity is **bounded work on untrusted structure**.

## The trap

1. **Trusting declared sizes.** `uncompressed_size` lies; caps must be enforced *while* inflating.
2. **Normalizing paths after lookup.** `a/../../etc/passwd` must be rejected or normalized before it touches anything.
3. **DTD processing.** Entity expansion ("billion laughs") turns a few KB into gigabytes.
4. **Loading everything at open.** Opening a book should cost the directory, not the book.

## The feature

- Central-directory parser with bounds-checked offsets.
- On-demand inflation with an output budget.
- OPF parser: metadata, manifest, spine (`linear`), nav/NCX location, cover.
- DRM detection.
- A tiny ZIP *writer* for test fixtures (stored entries are enough).

## Decision map

1. **Library vs own reader.** Speed of delivery vs understanding and control of limits.
2. **Whole file in memory vs random access (`ByteSource`).** Simplicity now vs M75/M76 later.
3. **Inflate caps.** Per entry · per archive · ratio-based.
4. **XML parser policy.** DTDs off · entities limited · depth limit.
5. **DRM meaning.** Refuse · open readable parts · flag only.

## Research targets

- **ZIP format — 45 min (deep).**
  **Done when:** you can draw EOCD → central directory → local header → data, and say which fields to trust.
- **DEFLATE — 25 min.**
  **Done when:** you can explain why output size is unknowable before inflating.
- **XML entity attacks — 25 min.**
  **Done when:** you can explain billion laughs and what turning off DTDs prevents.
- **EPUB OCF/OPF — 45 min (deep).**
  **Done when:** you can find spine order, the nav document and the cover in three real books by hand.

## Out of scope

ZIP64 writing, encryption algorithms, font de-obfuscation beyond recognizing it, media overlays, fixed-layout rendering.

## Measure ritual

**Numbers:** bomb ratio refused, peak bytes during open, time to open a 1,000-entry archive, and a mutation run of 10,000 corrupted archives with **0 panics**.

## Hint ladder

<details><summary>My zip bomb test still allocates gigabytes before failing</summary>

**Orient:** where is the cap checked — before, during, or after inflation?

**Approach:** a cap checked after inflation is a report, not a defense. Inflate into a bounded buffer and stop when output reaches the cap. Apply the same idea to the total across entries.

</details>

## The slow walk

1. Draw the container format and mark untrusted fields in red.
2. Write the ZIP writer for fixtures first.
3. Parse the central directory; reject inconsistencies.
4. Inflate with caps; verify CRC.
5. Parse container.xml and the OPF.
   **Check:** three real books list their spines correctly.
6. Add DRM detection.
7. Run the mutation test and fix every panic.

## Prove it — the three rooms

- **Interview:** narrate how the reader refuses a zip bomb without allocating it.
- **Design review:** a peer wants to `unzip` to a temp folder first. Count the ways that goes wrong.
- **Meetup:** "My EPUB reader treats every number in the file as a claim — opening a book costs its directory, not its contents."

**Reach-backs:** M36 streams · M39 break/fix security · M20 parser thinking.
**Compare after:** `crates/epub/src/zip.rs`, `package.rs`, `paths.rs`.

---

<a id="m62"></a>
# M62 — Sanitize by Rebuilding · XHTML allow-list, CSS & shadow-DOM rendering · (L)

> **Story.** As a reader builder, I want publisher XHTML and CSS rendered faithfully but without scripts, remote loads or layout attacks, with the rendered DOM text exactly equal to the engine's projection, so that anchors made on screen are portable.
>
> **MVP.** An allow-list sanitizer that *rebuilds* elements and attributes; a CSS re-serializer that drops remote `url()`, `@import`, `expression()` and `position: fixed`; resources (images, fonts) served through the engine; each chapter rendered in its own shadow root; an assertion that DOM text equals the projection.
>
> **Acceptance criteria.**
> - Scripts, event handlers, iframes, forms and `javascript:` URLs never survive a test corpus of hostile chapters.
> - Publisher CSS cannot style the app or fetch anything remote.
> - Images and fonts load through local URLs created from engine bytes.
> - DOM text equals the engine projection for 50 real books.
> - Internal links navigate; external links open with `noopener noreferrer`.

## Briefing

One parse should produce two things together: **safe markup and the text projection**. If they come from different passes or different parsers, they will drift, and the drift shows up as highlights on the wrong words.

Rebuilding from an allow-list is safer than filtering with a deny-list: anything you didn't name doesn't exist. Shadow DOM isolates publisher CSS from your app; your overlays (highlights, selection) live outside the shadow root, in your own light DOM.

The center of gravity is **one parse, two products, zero drift**.

## The trap

1. **Regex sanitizing.**
2. **Sanitize with one parser, render with another.** Parser differentials are how mutation XSS works.
3. **CSS as an attack surface.** `position: fixed`, huge `z-index` and remote `url()` reach outside the chapter.
4. **SVG.** Scripts and external references hide there.

## The feature

- Element/attribute allow-list with rewriting of resource references to an internal scheme.
- CSS tokenizer + re-serializer.
- A renderer that parses sanitized XHTML with the XML parser into a shadow root and resolves internal resources to blob URLs.
- A text-equality assertion in development builds.

## Decision map

1. **Allow-list granularity.** Elements · attributes · attribute values.
2. **Parser for rendering.** XML (exact, strict) · HTML (forgiving).
3. **Isolation.** Shadow DOM · sandboxed iframe.
4. **Resource scheme.** Custom scheme rewritten to blob URLs · data URLs.
5. **What the reader controls.** Font, size, spacing, colors — and how they beat publisher CSS.

## Research targets

- **Mutation XSS and parser differentials — 45 min (deep).**
  **Done when:** you can explain why sanitizing and rendering must agree on the parse tree.
- **Shadow DOM and style scoping — 25 min.**
  **Done when:** you can say which styles cross a shadow boundary (inherited properties, custom properties) and which don't.
- **Content Security Policy — 25 min.**
  **Done when:** you can write the CSP your app runs under and say what each directive forbids.
- **CSS attack surface — 25 min.**
  **Done when:** you can list five CSS features that act outside a chapter's box.

## Out of scope

Full CSS feature parity, MathML rendering, media overlays, scripted (interactive) EPUBs.

## Measure ritual

**Numbers:** survivors from 20 hostile fixtures (must be **0**), DOM-text mismatches across 50 books (must be **0**), chapter render time at the 95th percentile.

## Hint ladder

<details><summary>The DOM text is off by a few characters from the engine's text</summary>

**Orient:** which characters? Whitespace between blocks, entities, `<br>`, soft hyphens.

**Approach:** build the projection *from the sanitized tree you emit*, not from the original source. Then the renderer, parsing that same markup with an XML parser, produces the same text nodes. Write a test that diffs the two strings and prints the first differing context.

</details>

## The slow walk

1. Collect 50 books and 20 hostile chapters.
2. Write the allow-list as data.
3. Rebuild markup; emit text alongside.
4. Sanitize CSS by re-serializing tokens.
5. Render into shadow roots; resolve resources.
   **Check:** network panel shows zero remote requests.
6. Add the text-equality assertion.
7. Run the corpus and fix mismatches by rule, not by special case.

## Prove it — the three rooms

- **Interview:** explain why the projection is produced from the sanitized output.
- **Design review:** someone proposes DOMPurify plus `innerHTML`. Discuss what you'd keep and what the text contract still needs.
- **Meetup:** "I render publishers' HTML without trusting it — and the text on screen is provably the text my anchors use."

**Reach-backs:** M26 persistence/XSS · M39 break/fix security · M60.
**Compare after:** `crates/epub/src/content.rs`, `css.rs`; `app/src/reader/epub.ts`, `textmap.ts`.

---

<a id="m63"></a>
# M63 — Where Is That Letter? · PDF content streams, fonts & per-glyph geometry · (XL)

> **Story.** As an engine builder, I want a box for every character on any PDF page, in page space, so that selection and highlights work without a DOM text layer and without trusting a renderer.
>
> **MVP.** Interpret page content streams (text operators, graphics state, matrices), decode fonts (simple encodings, ToUnicode CMaps, Type0/CID), compute advances from widths, follow Form XObjects with recursion limits, and produce text with one box per character in a sensible reading order.
>
> **Acceptance criteria.**
> - Boxes overlay rendered glyphs within 1 px at 2× scale for a test corpus.
> - Ligatures and ToUnicode produce correct text.
> - Rotated pages and cropped pages are handled.
> - An operation budget per page is enforced.
> - Malformed streams return errors, never panics.

## Briefing

A PDF page is a small program that paints glyphs. "Text" is something you reconstruct: which glyph, which Unicode, which position. Once you have per-character geometry in page space, the renderer becomes interchangeable — pdf.js, a native rasterizer, or nothing at all (an e-ink page pack in M76).

The center of gravity is **geometry as the source of truth for fixed layouts**.

## The trap

1. **Matrix confusion.** The text matrix, text line matrix and CTM compose in a specific order.
2. **One byte per glyph.** CID fonts use multi-byte codes defined by CMaps.
3. **Painting order as reading order.** Columns, headers and footnotes interleave.
4. **Unbounded recursion and expansion.** Forms inside forms; CMap ranges expanded into giant tables.

## The feature

- Content-stream tokenizer and operator interpreter with a per-page operation budget.
- Font loader: encodings, `Differences`, ToUnicode, CID widths.
- Glyph advance computation including character and word spacing and horizontal scaling.
- Line grouping and reading order (XY-cut or similar).
- A debugging overlay: draw your boxes over a rendered page.

## Decision map

1. **Own interpreter vs renderer text layer.** Control and portability vs speed of delivery.
2. **Page cache.** How many pages, measured in what?
3. **Reading order.** Stream order · XY-cut · tagged-PDF structure.
4. **Geometry precision.** f32 per char · quantized per line.
5. **Where geometry lives on the web.** JSON · binary transfer.

## Research targets

- **Text operators and matrices — 45 min (deep).**
  **Done when:** you can compute a glyph's page-space box by hand from a stream excerpt.
- **Font encodings and ToUnicode — 45 min (deep).**
  **Done when:** you can explain how a byte becomes a Unicode string through three different routes.
- **CID fonts — 25 min.**
  **Done when:** you can read a codespace range and widths array.
- **Reading-order heuristics — 25 min.**
  **Done when:** you can predict XY-cut's output on a two-column page.

## Out of scope

Rasterizing glyph outlines, Type 3 glyph procedures beyond widths, interactive forms, PDF annotations, writing PDFs.

## Measure ritual

**Numbers:** median and worst overlay error in px over 30 PDFs from different producers; bytes per character of geometry; characters extracted per second; operations per page at the 99th percentile.

## Hint ladder

<details><summary>Boxes drift further right along each line</summary>

**Orient:** the advance per glyph is wrong by a small constant.

**Approach:** recompute one advance by hand: width from the font (in glyph space, usually /1000), times font size, plus character spacing, plus word spacing for the single-byte space code, times horizontal scaling. Compare with your code term by term.

</details>

<details><summary>Some PDFs extract as gibberish</summary>

**Orient:** which route maps codes to Unicode for that font?

**Approach:** check for a ToUnicode CMap first; then the encoding and Differences; then the font's built-in encoding. Log which route each font took — gibberish usually means you skipped one.

</details>

## The slow walk

1. Pick five PDFs from five producers.
2. Tokenize streams; print operators.
3. Track graphics and text state; print glyph origins.
4. Decode fonts; print text.
5. Compute boxes; draw the overlay.
   **Check:** within 1 px.
6. Add Forms, rotation, budgets.
7. Add reading order; test on two-column papers.

## Prove it — the three rooms

- **Interview:** narrate a glyph from `TJ` to a box in page space.
- **Design review:** "why not use pdf.js's text layer?" Discuss DOM cost, alignment, and portability to non-browser hosts.
- **Meetup:** "My PDF reader has no text layer in the DOM at all — selection runs on per-character geometry the engine computes."

**Reach-backs:** M60 · M20 parser thinking.
**Compare after:** `crates/pdf/src/interp.rs`, `fonts.rs`, `cmap.rs`, `layout.rs`.

---

<a id="m64"></a>
# M64 — Anchors That Survive Editions · multi-selector anchoring & fuzzy re-attachment · (L)

> **Story.** As a reader, I want my highlights to re-attach after a file is re-OCR'd, re-exported or replaced by another edition, so that notes are worth writing.
>
> **MVP.** An anchor stores several selectors at once — text position, the quoted text with surrounding context, an EPUB CFI, and page rectangles for scans without text. A resolver tries them in order: exact position, CFI, quote search, fuzzy quote search within an error budget scored by context, neighbouring units, rectangles. It reports *which method* succeeded.
>
> **Acceptance criteria.**
> - An edit matrix resolves as expected: same file → position; whitespace or ligature changes → quote; a paragraph inserted earlier → quote; a different edition with typos → fuzzy; a moved chapter → neighbour search.
> - Misattachments (anchoring to the wrong place) stay under a threshold you set before testing — and you prefer an orphan to a wrong attachment.
> - Resolving 1,000 anchors in a long chapter stays within your time budget.
> - The resolution method is visible to the UI (e.g. "approximate").

## Briefing

An anchor is a bet that some description of a passage will still identify it after the document changes. Positions are precise and brittle; quotes are robust and ambiguous; CFIs are structural and break when markup changes. Storing all of them and trying them in order turns three weak bets into one strong one.

Fuzzy matching makes this work across editions, and it is also where it can go wrong. A highlight silently moved to the wrong sentence is worse than one marked "couldn't find this".

The center of gravity is **graceful degradation with honest reporting**.

## The trap

1. **Quote without context.** "the" matches everywhere.
2. **Unbounded fuzzy search.** Bitap and edit-distance searches are cheap per window and expensive per book.
3. **Silent misattachment.** No method reported, no threshold, no orphan state.
4. **CFI as the only truth.** One re-export with different markup and every anchor breaks.

## The feature

- Anchor creation from (unit, start, end).
- A resolver chain with per-step budgets and method reporting.
- An orphan state the UI can show.
- A W3C Web Annotation export of the same selectors.

## Decision map

1. **Selector set.** Position · quote+context · CFI · rects · (your idea).
2. **Fuzzy matcher.** Bitap · diff-match-patch · n-gram index.
3. **Error budget.** Fixed · proportional to quote length.
4. **Search window.** Same unit · neighbours · whole document.
5. **Orphan UX.** Hide · list separately · show "approximate".

## Research targets

- **W3C Web Annotation selectors — 25 min.**
  **Done when:** you can express your anchor as a `TextQuoteSelector` + `TextPositionSelector` + `FragmentSelector`.
- **EPUB CFI — 45 min (deep).**
  **Done when:** you can generate and resolve a CFI by hand for a small chapter.
- **Bitap and approximate matching — 45 min (deep).**
  **Done when:** you can explain why Bitap's pattern length is bounded by the machine word and how to work around it.
- **Fuzzy anchoring in practice — 25 min.**
  **Done when:** you can describe how an existing annotation tool re-attaches after page edits.

## Out of scope

Semantic matching with embeddings, cross-language editions, collaborative live anchoring.

## Measure ritual

Build the edit corpus first. **Numbers:** correct method per case, misattachment rate (target near **0**), orphan rate, median and worst resolution time.

## Hint ladder

<details><summary>Fuzzy matching keeps attaching to the wrong occurrence</summary>

**Orient:** what distinguishes the right occurrence — the quote or its surroundings?

**Approach:** score candidates by quote similarity *and* prefix/suffix similarity, require a minimum quote length for fuzzy search, and prefer the candidate nearest the old position when scores tie. When the best score is weak, orphan it.

</details>

## The slow walk

1. Write the edit corpus with expected outcomes.
2. Implement position and exact-quote resolution.
3. Add context scoring.
4. Add CFI (EPUB) and rects (scans).
5. Add fuzzy search with budgets.
   **Check:** misattachment rate on the corpus.
6. Expose the method; design the orphan UI.
7. Export to W3C and re-import.

## Prove it — the three rooms

- **Interview:** explain why the resolver prefers an orphan to a guess.
- **Design review:** a peer stores only CFIs because "it's the standard". Run your edit corpus at them.
- **Meetup:** "My highlights survive re-OCR and new editions because each anchor carries several descriptions and the resolver tells you which one it used."

**Reach-backs:** M60 · M62 · M63.
**Compare after:** `crates/core/src/anchor.rs`, `matcher.rs`, `webanno.rs`.

---

<a id="m65"></a>
# M65 — Pictures of Words · an OCR pipeline in workers · (L)

> **Story.** As a reader of scanned PDFs, I want text recognized on my device so that scans become selectable, searchable and annotatable like native text, without uploading anything.
>
> **MVP.** Detect pages that are scans (no text, large image); rasterize; detect text lines; recognize them; build a text layer with geometry in page space; run in workers; persist the layer; anchors and search work on it.
>
> **Acceptance criteria.**
> - Recognized text is selectable with boxes that sit on the words.
> - The layer survives reloads and is never recomputed unasked.
> - Progress is visible; cancelling works.
> - Memory is bounded: workers are released when idle, and phones get fewer.
> - The OCR engine sits behind an interface: a second engine (e.g. Tesseract output) plugs in without touching callers.

## Briefing

OCR is a pipeline, not a model: preprocessing, line detection, recognition, reading order, and coordinate transforms back to the page. In the browser, parallelism means workers, and without shared memory every worker holds its own copy of the models — so the speed you buy costs megabytes you must budget.

The trick that made this repo's version fast: detect lines *once*, then split the recognition of lines across workers by estimated cost, sending the page image once per worker and only line boxes per batch.

The center of gravity is **coordinate spaces and the time/memory trade of parallelism**.

## The trap

1. **OCR on the main thread.**
2. **One model copy per worker on a 2 GB phone.**
3. **Mixing pixels, PDF points and CSS pixels.**
4. **Re-OCR invalidating notes.** (M64 is what saves you.)

## The feature

- Scan detection.
- Rasterization at a pixel budget.
- A worker pool sized by device memory and cores, released when idle.
- Two-phase OCR: detect, then recognize in parallel.
- A text layer in the same format as native text, persisted per page.

## Decision map

1. **Engine.** ocrs · tesseract.js · PaddleOCR via ONNX · platform OCR.
2. **Where.** On device · on a home server (M75).
3. **Pool size policy.** Fixed · `deviceMemory` + cores.
4. **Phases.** Monolithic · detect once, recognize in parallel.
5. **Layer format.** Same as native text · separate.

## Research targets

- **OCR pipeline stages — 45 min (deep).**
  **Done when:** you can name what detection outputs and what recognition consumes.
- **WASM threads, COOP/COEP — 25 min.**
  **Done when:** you can say why shared-memory threads may be unavailable in your host.
- **Coordinate transforms — 25 min.**
  **Done when:** you can map a pixel box in a 2× rendering of a rotated page to PDF user space.
- **Engine comparison and licenses — 25 min.**
  **Done when:** you can reject one engine for a licensing reason and one for a memory reason.

## Out of scope

Handwriting, training models, math OCR, full layout analysis beyond columns.

## Measure ritual

**Numbers:** seconds per dense page (single worker vs pool), peak memory per worker, character error rate on a fixture with known text, and time until the first selectable word appears.

## Hint ladder

<details><summary>The pool is slower than one worker</summary>

**Orient:** what crosses the worker boundary per task?

**Approach:** if each task carries the full page image, you are paying the copy N times. Send the image once per page per worker, then send only line boxes. Balance batches by estimated cost, not by count.

</details>

## The slow walk

1. Detect scans; show a badge.
2. Rasterize one page at a fixed pixel budget.
3. Run detection and recognition in one worker.
4. Map results to page space; overlay boxes.
   **Check:** boxes sit on the words.
5. Build the layer; select and highlight on it.
6. Split into a pool; measure.
7. Persist; add idle release.

## Prove it — the three rooms

- **Interview:** explain the two-phase split and what it costs in memory.
- **Design review:** "just use a server" — compare privacy, cost and offline behaviour.
- **Meetup:** "Scanned pages become real text on the phone — and the highlights you make survive if you OCR again."

**Reach-backs:** M63 · M64 · M32 constrained hardware.
**Compare after:** `crates/ocr/src/lib.rs`, `neural.rs`; `app/src/engine/ocr-pool.ts`, `ocr-worker.ts`.

---

<a id="m66"></a>
# M66 — One Engine, Every Host · JSON RPC, C ABI, WASM, Python · (L)

> **Story.** As a platform engineer, I want one engine reachable from Rust, C (and through it Swift, Kotlin, C#), Python and the browser through one documented contract, so that behaviour cannot drift between platforms.
>
> **MVP.** A JSON RPC facade (`method`, `args`) → result or `{error: {code, message}}`; a C ABI (open, call, free — the caller frees what the library returns); WASM bindings running in a worker; a Python wrapper; panics caught at the C boundary; methods that need no document callable without one; a binary side channel for hot data.
>
> **Acceptance criteria.**
> - For a fixture set, the same call returns identical JSON from C, Python and WASM.
> - No panic crosses the C boundary; after a panic the session refuses calls with a clear code.
> - Memory ownership is documented and a leak check of the C example passes.
> - Geometry for a dense page travels as binary, not JSON.

## Briefing

A JSON contract is slower than native calls and prevents a thousand small API mismatches. Every host forwards `(method, args)`; behaviour lives in one place. Hot paths get side channels (a transferred `Float32Array` for geometry).

Two failure facts shape the boundary. In native code a Rust panic must be caught before it unwinds into C. In WebAssembly a panic is a trap that leaves the instance unusable — so recovery is part of the contract (M71).

The center of gravity is **one contract, translated at the edges**.

## The trap

1. **Returning Rust-owned memory without a free function.**
2. **Panics unwinding into C.**
3. **Reusing a trapped WASM instance.**
4. **JSON for 100,000 floats.**

## The feature

- RPC dispatcher with stable error codes.
- C header + library; a C example; a Python wrapper.
- WASM bindings in a worker with a promise-based client.
- Static (document-free) methods.
- Binary geometry transfer.

## Decision map

1. **Serialization.** JSON · FlatBuffers · Cap'n Proto.
2. **Error model.** Codes + messages · exceptions per host.
3. **Offset unit per host.** Chosen at session open.
4. **Browser threading.** Main thread · one worker per document.
5. **Static vs session methods.**

## Research targets

- **Rust FFI and `catch_unwind` — 45 min (deep).**
  **Done when:** you can explain why unwinding across `extern "C"` is undefined and how to stop it.
- **wasm-bindgen and JS interop costs — 25 min.**
  **Done when:** you can say what a string or `Vec<f32>` costs to cross.
- **Structured clone and transferables — 25 min.**
  **Done when:** you can move a buffer to a worker without copying.
- **ctypes — 25 min.**
  **Done when:** your Python wrapper frees every string it receives.

## Out of scope

Full Swift/Kotlin packages, gRPC, generating bindings for every language.

## Measure ritual

**Numbers:** call overhead per transport (µs), bytes per character for geometry as JSON vs binary, leaked allocations in the C example (must be **0**).

## Hint ladder

<details><summary>After one panic, every call fails</summary>

**Orient:** the instance or session is poisoned — a trapped WASM instance, or a poisoned mutex natively.

**Approach:** stop treating it as recoverable in place. Natively, report `panic` and require a reopen. In WASM, discard the instance, start a new one, reopen the file and restore state from your store.

</details>

## The slow walk

1. Write `docs/API.md` before code: methods, args, results, error codes.
2. Implement the dispatcher in Rust; test it directly.
3. Add the C ABI and a C example.
4. Add Python.
5. Add WASM in a worker with a promise client.
   **Check:** fixture parity across hosts.
6. Add binary geometry.
7. Add static methods; document panic behaviour.

## Prove it — the three rooms

- **Interview:** explain the JSON contract and where you broke your own rule for speed.
- **Design review:** a peer wants direct wasm-bindgen methods for everything. Discuss drift and the cost of each new host.
- **Meetup:** "My reader engine is one Rust library with a JSON contract — the browser, Python and C all get the same answers."

**Reach-backs:** M31 Electron privilege boundary · M4/M39 trust boundary · M60.
**Compare after:** `crates/marginalia/src/rpc.rs`, `crates/ffi/`, `crates/wasm/src/lib.rs`, `bindings/python/marginalia.py`, `docs/API.md`.

---

<a id="m67"></a>
# M67 — A Grammar Small Enough to Trust · note links shared by every host · (M)

> **Story.** As a note-taker, I want notes that link to other notes and to web pages, written in a markup so small that every host parses it identically, so a link never means two things.
>
> **MVP.** Write the grammar first (an EBNF-style page). Implement it twice — in the engine and in the UI language. Keep hand-written vectors for edge cases and generated differential vectors from the canonical implementation. Prove a round-trip property and a linear-time bound. Allow only safe URL schemes.
>
> **Acceptance criteria.**
> - Both implementations agree on every vector.
> - `parse(serialize(parse(s))) == parse(s)` for 100,000 random notes.
> - A 200 KB hostile note parses in milliseconds in both languages.
> - `javascript:` and `data:` are never links.
> - The serializer never emits markup that re-parses differently.

## Briefing

This repo's first version of this grammar looked finished and had four parity bugs between Rust and TypeScript:
- whitespace classes (`\s` vs Unicode `White_Space`);
- length counted in bytes vs UTF-16 units;
- escape rules that differed in labels;
- a byte-order mark trimmed by one side only.

It also had two quadratic paths and a serializer that could change meaning. None of these showed up in hand-written tests. A grammar is only "shared" if a test makes it so.

The center of gravity is **making two implementations provably one**.

## The trap

1. **Regex parsers.**
2. **"It's like Markdown."** It isn't — say exactly what it is.
3. **Predicates that differ by language** (`is_whitespace`, `trim`, `length`).
4. **Scans that restart.** Each candidate rescanning to the end of the note.
5. **Trusting the serializer.**

## The feature

- The grammar page.
- Canonical parser and serializer.
- A mirror in the UI language.
- Hand-written and generated vector files run by both test suites.
- Property and timing tests.

## Decision map

1. **Markup vs structured JSON in notes.**
2. **Escapes.** Which characters, and in which contexts.
3. **URL policy.** Schemes allowed; length limit.
4. **Limits.** Label length, URL length, in which unit.
5. **Canonical home.** Which implementation generates the vectors.

## Research targets

- **Unicode properties `White_Space` and `Cc` — 25 min.**
  **Done when:** you can list characters on which `\s` and `White_Space` disagree.
- **Property-based testing — 25 min.**
  **Done when:** you can state your round-trip property precisely.
- **Differential testing — 25 min.**
  **Done when:** you have a generator whose alphabet is made of the characters that broke you.
- **Linear-time parsing and ReDoS — 25 min.**
  **Done when:** you can argue each scan is bounded and never restarts over the same input.

## Out of scope

Full Markdown, rich-text editing, mentions and hashtags (wait for M73).

## Measure ritual

**Numbers:** parity mismatches (must be **0**), property failures (must be **0**), and parse time vs note length plotted for hostile shapes.

## Hint ladder

<details><summary>Rust and TypeScript disagree on one weird input</summary>

**Orient:** which predicate decided differently?

**Approach:** list every predicate both implementations use — whitespace, control characters, trimming, length, case-insensitive prefix — and make both use the same definition (Unicode properties, code points). Then add that character to the generator's alphabet so it can never regress.

</details>

<details><summary>Some notes take seconds to parse</summary>

**Orient:** find the scan that restarts from each candidate position.

**Approach:** bound every scan (a label can't contain `[`; a target can't contain brackets; a too-long URL run is text as a whole) so that each character is visited a constant number of times.

</details>

## The slow walk

1. Write the grammar page.
2. Implement the canonical parser; hand-written vectors.
3. Implement the serializer; property test.
4. Mirror in the UI language; run the shared vectors.
5. Generate differential vectors from the canonical side.
   **Check:** the mirror passes all of them.
6. Add hostile timing tests in both languages.
7. Expose the grammar to every host without a document.

## Prove it — the three rooms

- **Interview:** describe a parity bug you found and the test that now prevents it.
- **Design review:** a peer wants to "just use a Markdown library" in each language. Show what differential tests would find.
- **Meetup:** "My notes link to each other with a grammar small enough to specify on one page — and two implementations that a test proves identical."

**Reach-backs:** M20 parser thinking · M60.
**Compare after:** `crates/core/src/links.rs`, `app/src/notes/markup.ts`, `app/src/notes/markup-vectors.json`, `markup-fuzz-vectors.json`, `app/scripts/markup-test.ts`.

---

<a id="m68"></a>
# M68 — Your Selection, Not the OS's · custom selection with handles on touch · (L)

> **Story.** As a mobile reader, I want to double-tap a word, drag two handles to adjust, and get a highlight that matches the text exactly — on PDF canvases and in shadow-DOM chapters alike — without fighting the phone's own selection UI.
>
> **MVP.** Hit-testing (caret-from-point through shadow roots for EPUB; geometry for PDF); double-tap selects a word; long-press and mouse drag work too; two handles that swap when they cross; auto-scroll near edges; painting coalesced to animation frames; keyboard-movable handles; the OS selection and callout disabled over the document.
>
> **Acceptance criteria.**
> - Selection rectangles align within 1 px with the text on EPUB and PDF.
> - Tested with real touch events (e.g. CDP touch emulation), not only mouse events.
> - No OS callout or native selection appears over the document.
> - Dragging holds 60 fps on a mid-range phone.
> - Taps on links, highlights and controls still work.

## Briefing

The browser's selection doesn't know your canvas has text, can't cross shadow roots consistently, and comes with a platform callout you can't style. Owning selection makes PDF and EPUB behave identically and gives you the gestures you design. The price is that you now own hit-testing, word boundaries, gesture arbitration and performance.

The center of gravity is **gesture arbitration and layout-free dragging**.

## The trap

1. **Half-disabling the OS.** Forget one of `user-select`, `touch-action`, `contextmenu`, `selectstart` and the platform fights back.
2. **Reading layout in `pointermove`.** Forced reflow every frame.
3. **Handles that can't cross.**
4. **Testing with a mouse only.** Touch has different timing, cancellation and scrolling.
5. **Tap vs double-tap.** A single tap must wait out the double-tap window — decide what that costs.

## The feature

- Hit-testing per surface.
- Word boundaries (`Intl.Segmenter` or your own).
- Handles with generous hit areas.
- A paint layer of pooled rectangles moved by transforms.
- A gesture state machine: tap, double-tap, long-press, drag, scroll.

## Decision map

1. **What is hit-testable.** Text only · images · controls.
2. **Word rules.** Segmenter · whitespace split · language-aware.
3. **Handle geometry and hit areas.**
4. **Paint strategy.** DOM rects · SVG · canvas.
5. **Arbitration.** Which gesture wins, and when.

## Research targets

- **Pointer Events and `touch-action` — 25 min.**
  **Done when:** you can predict when the browser takes over a gesture for scrolling.
- **`caretPositionFromPoint` and shadow roots — 25 min.**
  **Done when:** you have a fallback for browsers that can't pierce a shadow root.
- **`Intl.Segmenter` — 25 min.**
  **Done when:** you can select a word in Japanese and in English.
- **Compositor-friendly animation — 25 min.**
  **Done when:** you can explain why `transform` beats `top/left` while dragging.

## Out of scope

Selection across pages or chapters, bidirectional selection, screen-reader selection (note it for M72).

## Measure ritual

**Numbers:** alignment error (px), frame time while dragging, false double-tap rate in a scripted session.

## Hint ladder

<details><summary>Dragging a handle stutters</summary>

**Orient:** what does each `pointermove` do?

**Approach:** if it measures text ranges or reads `getBoundingClientRect` in loops, you're forcing layout per event. Cache rects per unit, compute hit positions from cached geometry, coalesce updates to one animation frame, and move pooled elements with transforms.

</details>

## The slow walk

1. Disable the OS selection over the document; verify on a real phone.
2. Hit-test a word on each surface; log offsets.
3. Double-tap to select; paint rects.
4. Add handles and dragging; swap on cross.
5. Add long-press, mouse drag, auto-scroll, keyboard.
6. Write touch-driven e2e tests.
   **Check:** alignment within 1 px.
7. Profile dragging on a real device.

## Prove it — the three rooms

- **Interview:** explain why you replaced the platform selection and what you had to rebuild.
- **Design review:** "why not use the native selection and read it?" Walk through canvas pages and shadow roots.
- **Meetup:** "Double-tap a word, drag the handles — the same selection works on PDF canvases and EPUB chapters because the app owns it."

**Reach-backs:** M27 selection/clipboard · M43 reactivity · M60 · M63.
**Compare after:** `app/src/reader/selection.ts`, `geometry.ts`, `epub.ts` (`caretFromPoint`), `pdf.ts` (`hit`).

---

<a id="m69"></a>
# M69 — Paint Only What Is Seen · virtualization, budgets & chapter windows · (L)

> **Story.** As a reader on a cheap phone, I want a 1,000-page PDF or a 300-chapter EPUB to open fast and stay smooth, so that memory is proportional to what is on screen rather than to the book.
>
> **MVP.**
> - PDF: canvases exist only near the viewport, under a budget, rendered nearest-first; file bytes are range-loaded rather than held on the main thread; geometry crosses to the UI as a transferred binary buffer.
> - EPUB: either continuous virtualization (placeholders that keep their height) or discrete windows (one chapter in the DOM at a time).
> - Closed screens are verifiably released.
>
> **Acceptance criteria.**
> - Resident memory stays flat while scrolling a long document end to end.
> - Never more than your budgeted number of live canvases (or bytes).
> - Moving to another chapter takes under your budget (e.g. 150 ms).
> - Nothing re-renders when nothing changed.
> - A heap snapshot after repeated open/close cycles finds **zero** retained reader screens.

## Briefing

The bytes you never load are the fastest bytes. There are two shapes:

- **Continuous virtualization.** One long scroll, with far content replaced by placeholders of the right height. Seamless, but every placeholder, observer and offscreen node is a tax, and heights are guesses until loaded.
- **Discrete windows.** Only the current chapter exists; moving on is a brief load. A hard memory bound, a calmer interface (M72), and a natural unit for bite-sized commenting (M73).

This repo defaults to windows for EPUB and continuous virtualization for PDF. Both choices are defensible; write down why you chose yours.

The lesson that cost this repo the most: **things registered on long-lived objects keep whole screens alive.** One `selectionchange` listener on `document` retained every reader ever opened — view, page data, engine handles — until a heap snapshot found it.

The center of gravity is **budgets you can measure, and lifetimes you can prove**.

## The trap

1. **Budgeting canvases by count.** A desktop page at 2× is three times a phone page.
2. **Holding the file on the main thread** "just for pdf.js".
3. **Listeners on `document`, `window` or `visualViewport` never removed.**
4. **Re-rendering on every scroll event.**
5. **Reading layout in loops.**

## The feature

- PDF page manager: visibility, render queue, canvas budget, release.
- EPUB chapter manager: windows or continuous with unloading.
- Range-loaded file access for the renderer.
- Binary geometry transfer.
- A heap-snapshot probe: tag each screen with a unique class, count survivors.

## Decision map

1. **Window vs continuous** (per format).
2. **Budget units.** Count · bytes · device-dependent.
3. **Prefetch.** None · engine payload only · DOM.
4. **Placeholder heights.** Estimated · measured once · stored.
5. **Zoom.** Re-render immediately · CSS scale during the gesture, re-render on settle.

## Research targets

- **IntersectionObserver — 25 min.**
  **Done when:** you can use two observers with different margins for load and unload.
- **Canvas memory — 25 min.**
  **Done when:** you can compute the bytes of a canvas at a device pixel ratio.
- **Heap snapshots and retaining paths — 45 min (deep).**
  **Done when:** you can find what retains a detached DOM tree.
- **Range loading in your renderer — 25 min.**
  **Done when:** your renderer reads the file through a range transport.

## Out of scope

Tile rendering at extreme zoom, WebGPU, server-side rendering.

## Measure ritual

**Numbers:**
- resident memory after 0, 100 and 1,000 pages scrolled;
- worst frame time while scrolling;
- chapter switch time;
- **retained screens after N open/close cycles (must be 0).**

## Hint ladder

<details><summary>Memory grows every time I open and close a book</summary>

**Orient:** something long-lived holds a reference to the screen.

**Approach:** tag each screen object with an instance of a uniquely named class, take a heap snapshot after closing a few, and follow the retaining path from a GC root to your probe. The first object on that path you own is usually a listener on `document`, `window` or a shared store.

</details>

## The slow walk

1. Write the Budget Sheet for both formats.
2. PDF: visibility, queue, budget.
3. EPUB: pick windows or continuous; implement.
4. Range-load the file; transfer geometry as binary.
5. Add the heap probe and an automated leak check.
   **Check:** zero retained screens.
6. Profile scrolling on a real device; fix the worst frame.

## Prove it — the three rooms

- **Interview:** explain your window vs continuous decision and its measured cost.
- **Design review:** a peer wants to keep all chapters in the DOM "for search". Show the memory curve and where search actually lives (the engine).
- **Meetup:** "My reader holds one chapter at a time — and a heap snapshot in CI proves closed books are actually gone."

**Reach-backs:** M37 interactive visuals · M60 · M63.
**Compare after:** `app/src/reader/pdf.ts`, `epub.ts` (window mode); `app/e2e/lib.mjs` (`countLive`).

---

<a id="m70"></a>
# M70 — Notes That Outlive the Tab · IndexedDB, revisions, tombstones & sync · (L)

> **Story.** As a reader, I want every note saved atomically on my device, with history and deletions that sync, so that a crash, a reload or an offline week never loses or half-saves anything.
>
> **MVP.**
> - Stores: documents, files (as `Blob`s), annotations, revisions, a link index, OCR layers, an outbox.
> - Each edit is one transaction writing the annotation, a revision and the link index.
> - Deletions are tombstones.
> - The outbox flushes to a cloud mirror; last-writer-wins merges incoming changes.
> - The browser is asked for persistent storage; full export and import exist.
>
> **Acceptance criteria.**
> - Killing the tab mid-save leaves either the full edit or none of it.
> - Backlinks always agree with notes.
> - Deleting syncs, and nothing resurrects.
> - Import never overwrites a newer edit.
> - Records written by older or newer versions are normalized or dropped, never fatal.
> - A full disk produces a specific, actionable message.

## Briefing

Local-first: the device is the source of truth; the cloud is a mirror. IndexedDB gives you atomic transactions — with one rule that bites everyone once: a transaction commits when control returns to the event loop with no pending requests. Await anything that isn't an IndexedDB request inside one and it's gone.

The center of gravity is **the unit of work**.

## The trap

1. **Awaiting a non-IDB promise inside a transaction.** This repo did it, via a "is cloud enabled?" check.
2. **Wall-clock last-writer-wins** across devices with skewed clocks.
3. **Hard deletes** that resurrect on the next sync.
4. **Derived data outside the transaction.** A link index that drifts from the notes.
5. **Trusting your own stored records.** They were written by another version of you.

## The feature

- Schema with keys and indexes.
- `saveAnnotation` as one transaction.
- Revisions and tombstones.
- An outbox and a flush loop.
- A merge function.
- Normalization of records read from storage, the cloud or backups.

## Decision map

1. **Atomicity unit.** Per edit · per batch.
2. **Merge policy.** Record LWW · per-field LWW · CRDT.
3. **Clock.** Wall · hybrid logical clock.
4. **Files.** `Blob` in IndexedDB · OPFS.
5. **What syncs.** Notes yes; files opt-in; why.

## Research targets

- **IndexedDB transaction lifetime — 45 min (deep).**
  **Done when:** you can predict whether a transaction is still active after an `await`.
- **Local-first software — 25 min.**
  **Done when:** you can name the guarantees you keep and the ones you don't.
- **Hybrid logical clocks — 25 min.**
  **Done when:** you can show two skewed devices converging correctly.
- **Storage persistence and eviction — 25 min.**
  **Done when:** you know when a browser may delete your data and how to ask it not to.

## Out of scope

CRDT text merging, multi-user permissions (M73), the server side (M75).

## Measure ritual

**Numbers:** a crash matrix (kill during each write phase → state), convergence after offline edits on two devices, storage bytes per 1,000 notes.

## Hint ladder

<details><summary>"The transaction has finished" before my second write</summary>

**Orient:** what did you await between creating the transaction and the write?

**Approach:** any non-IndexedDB await lets the transaction auto-commit. Move that work before the transaction starts (compute, fetch flags, read settings), then do all requests back-to-back.

</details>

## The slow walk

1. Write the schema and the unit of work in prose.
2. Implement `saveAnnotation` as one transaction.
   **Check:** kill-mid-save test.
3. Add revisions and tombstones.
4. Add the link index inside the same transaction.
5. Add the outbox and a fake remote; then the real one.
6. Add merge and normalization.
7. Add export/import and storage-full handling.

## Prove it — the three rooms

- **Interview:** narrate one save from button to commit and explain why it can't half-happen.
- **Design review:** a peer stores notes in `localStorage` and syncs on a timer. Walk the failure cases.
- **Meetup:** "My notes are local-first: each edit is one transaction with history, and the cloud is just a mirror that can't lose them."

**Reach-backs:** M10 migration · M26 persistence/XSS · M2 PostgreSQL (contrast) · M7 presence vs persistence.
**Compare after:** `app/src/store/library.ts`, `idb.ts`, `cloud.ts`.

---

<a id="m71"></a>
# M71 — Nothing Takes the App Down · error containment & recovery · (M)

> **Story.** As a user between releases, I want a throwing button, a damaged record, a crashed engine or a stale deploy to cost me a message — never my screen, never my notes.
>
> **MVP.**
> - Every UI handler is guarded, and global handlers are the last line.
> - A route boundary replaces a failed screen with an error screen. That screen offers reload, back, "download a backup of my notes" and "copy details".
> - Engine crash recovery: detect the trap, start a new instance, reopen the file, restore state from the store.
> - A worker that cannot load fails fast and offers reload.
> - A schema upgrade from another tab stops writes and offers reload; a newer schema is tolerated after a rollback.
> - Save errors are honest, and a small diagnostics ring buffer exists.
>
> **Acceptance criteria.** Failure injection in end-to-end tests leaves the app usable with a specific message for each of these:
> - an uncaught error and an unhandled rejection;
> - malformed stored records;
> - a blocked worker script;
> - a `versionchange` from another tab.
>
> A unit test drives engine crash recovery against a fake worker.

## Briefing

Between dev cycles, failure comes from version skew as much as from bugs:
- old pages referencing files a new deploy removed;
- a new tab upgrading the schema under an old one;
- an old build opening data written by a new one.

And in WebAssembly a Rust panic is a trap that leaves the instance unusable: every later call fails. Recovery means a new instance, restored from your source of truth (M70) — which is why that source of truth matters.

The center of gravity is **containment, then recovery, then honesty**.

## The trap

1. **`void promise` everywhere.**
2. **Lying errors.** "Couldn't save" after it saved.
3. **Restart loops.** A deterministic crash restarted forever.
4. **An error screen that depends on what failed.**
5. **Teardown that throws** and blocks navigation.

## The feature

- `guard`, `background` and global handlers.
- A notice taxonomy (one sentence, one action).
- A route boundary with a rescue export.
- Engine client restart logic with a crash budget.
- Storage reopen, versionchange and rollback handling.
- Diagnostics without note content.

## Decision map

1. **Where boundaries sit.** Handler · screen · app.
2. **Restart policy.** Crashes per minute before giving up.
3. **What is restorable** and from where.
4. **Message taxonomy.** Which errors deserve words, which are silent.
5. **Diagnostics vs privacy.**

## Research targets

- **WASM traps and `panic = abort` — 25 min.**
  **Done when:** you can explain why the instance is unusable after a panic.
- **IndexedDB `versionchange` and `blocked` — 25 min.**
  **Done when:** you can sequence two tabs during an upgrade.
- **`unhandledrejection` and `error` events — 25 min.**
  **Done when:** you know which failures reach them.
- **Chaos and failure injection — 25 min.**
  **Done when:** you have a list of injections and expected outcomes.

## Out of scope

Remote error reporting services, automatic bug filing, offline install.

## Measure ritual

**Numbers:** injected failures that leave the app usable (must be **all**), time to recover after an engine crash, notices shown per injected failure (one, not five).

## Hint ladder

<details><summary>After a panic, every call fails with "recursive use of an object"</summary>

**Orient:** the WASM instance trapped mid-call and its borrow flags never reset.

**Approach:** don't retry in place. Mark the worker crashed, answer every later call with `crashed`, start a new worker, reopen the same file and restore annotations and OCR layers from storage. Fail the call that crashed with a readable message; let later calls wait for the new instance.

</details>

## The slow walk

1. List every failure you can inject.
2. Add the global last line; then guards; then the route boundary.
3. Build the error screen with the rescue export.
4. Add engine crash recovery with a fake-worker test.
5. Add storage resilience (reopen, upgrade, rollback, normalization).
6. Make save errors honest.
7. Write e2e failure injections.
   **Check:** each leaves a usable app.

## Prove it — the three rooms

- **Interview:** explain how the reader recovers from an engine panic without losing a note.
- **Design review:** a peer wants a global `try/catch` and a reload. Show what it loses.
- **Meetup:** "I inject failures into my reader in CI — a crashed engine, a stale deploy, a damaged record — and the app keeps your notes and tells you what happened."

**Reach-backs:** M14 telemetry · M66 · M70.
**Compare after:** `app/src/ui/errors.ts`, `app/src/engine/client.ts`, `worker.ts`, `app/src/store/library.ts`, `idb.ts`, `app/scripts/engine-test.ts`.

---

<a id="m72"></a>
# M72 — Reading for Attention · focus mode, front matter & calm controls · (M)

> **Story.** As a reader with ADHD or autism — or simply a tired one — I want everything except what I'm reading to step back, controls that never move under my thumb, and a sense of how much is left, so that I can stay with a long text.
>
> **MVP.**
> - Focus mode:
>   - *Paragraph* mutes everything except the paragraph at a fixed reading line;
>   - *Ruler* dims everything except a band.
> - A reduced-motion setting independent of the operating system.
> - Line spacing.
> - "Minutes left in this chapter".
> - Contents that follow your position.
> - Front matter (cover, title page, copyright, printed contents) folded into one piece, and books opening on their first page.
> - Settings persisted per device.
>
> **Acceptance criteria.**
> - At least three people try a ten-minute reading task, including at least one who self-identifies as neurodivergent; you record what helped and what didn't.
> - Muted text and the ruler meet your stated contrast targets; focused text keeps full contrast.
> - With reduced motion on, nothing animates.
> - Controls are reachable by keyboard and labelled for screen readers.
> - End-to-end tests cover each mode.

## Briefing

Accessibility here is **attention design**. The page should help you hold one thing at a time:
- mute what you're not reading;
- keep controls where they were;
- make time visible;
- don't make people wade through five pages of copyright and publisher logos before page one.

Front matter is a small example of a big idea: the engine can know a book's structure (landmarks, guide, TOC titles, file names, text) better than the UI can guess it, so detection belongs in the engine (M66), presentation in the host.

The center of gravity is **less on screen, never less control**.

## The trap

1. **Designing for an imagined user.** Test with real ones.
2. **Muting with nested opacity.** It compounds; a focused paragraph inside a muted quote stays muted.
3. **Focus that jumps** unpredictably while scrolling.
4. **Streaks and badges** that add pressure.
5. **A separate "accessible mode" app.**
6. **Folding real content.** A long foreword is not front matter.

## The feature

- A reading-line model shared by focus modes.
- Paragraph muting inside rendered chapters.
- A ruler overlay that works on any surface.
- Front-matter detection in the engine and a folded presentation.
- A contents panel that follows position (sidebar on wide screens, floating flyout on phones).
- Settings with sensible, calm defaults.

## Decision map

1. **What is a paragraph.** DOM blocks · geometry lines (PDF).
2. **Reading line position and band height.**
3. **Mute strength and method.** Color · opacity · blur (don't).
4. **Follow scroll vs tap to focus.**
5. **Front-matter authority.** Engine · host · user override.
6. **Defaults.** What a first-time reader sees.

## Research targets

- **WCAG 2.2 success criteria that apply — 25 min.**
  **Done when:** you can name the criteria your muted text and controls must meet.
- **`prefers-reduced-motion` — 25 min.**
  **Done when:** you honour both the system setting and your own.
- **Reading aids and attention — 45 min (deep).**
  **Done when:** you can describe reading rulers and line focus *and* state honestly what evidence does and doesn't support. Don't make medical claims.
- **EPUB landmarks and the `<guide>` — 25 min.**
  **Done when:** you can find cover, title page and body start in three books.

## Out of scope

Medical claims, diagnosis, eye tracking, text-to-speech (next), dyslexia fonts (next).

## Measure ritual

**Numbers:**
- contrast ratios of muted and focused text;
- frame time with focus mode on while scrolling;
- front-matter detection precision on 30 books (and zero real chapters folded);
- the user notes — the real measure.

## Hint ladder

<details><summary>Muted text inside a focused quotation is still muted</summary>

**Orient:** opacity multiplies down the tree.

**Approach:** mute with color on the container and override color inside the focused block. Then the focused block's descendants are full contrast regardless of nesting.

</details>

<details><summary>My front-matter detector folded the prologue</summary>

**Orient:** which signal said "front matter"?

**Approach:** order signals by authority (landmarks/guide > TOC titles > file names > text), cap each role's length, and require the run to end on a definite role — a short unlabelled page at the start of a book isn't front matter on its own.

</details>

## The slow walk

1. Watch someone read in your app for ten minutes. Write down every distraction.
2. Implement the ruler (any surface).
3. Implement paragraph focus (EPUB).
4. Add reduced motion, spacing, minutes left.
5. Add front-matter detection in the engine; fold it in the host.
6. Add contents that follow position.
7. Test with three people; revise defaults.

## Prove it — the three rooms

- **Interview:** explain the reading line and why mute-by-color beats opacity.
- **Design review:** a peer wants an "accessibility mode" toggle that changes everything. Argue for small, independent settings.
- **Meetup:** "My reader can mute everything but the paragraph you're on — and it skips the five pages of copyright so the book opens where the book starts."

**Reach-backs:** M15 layout · M56 visual hierarchy · M68 · M69.
**Compare after:** `app/src/reader/focus.ts`, `settings.ts`, `toc.ts`, `epub.ts` (`FRONT_CSS`, window mode); `crates/epub/src/front.rs`.

---

<a id="m73"></a>
# M73 — Longform, Bite-Sized, Together · social reading without the attention economy · (L)

> **Story.** As a reader, I want to discuss a book with friends passage by passage — like comments under a post — without uploading the book and without turning reading into a feed I can't put down.
>
> **MVP.**
> - Margin badges with note counts per paragraph.
> - Reply threads (a note can answer another).
> - Shareable passage cards (short quote + note + source).
> - A reading circle: an explicit, shared space keyed by the file's hash, with membership.
> - Private by default.
>
> **Acceptance criteria.**
> - Two people on two devices with the same file see each other's circle notes on the same passages.
> - Nothing is shared without an explicit action by its author.
> - Removing a member stops their access to new notes.
> - The book file never leaves the device; quotes are capped.
> - A privacy matrix (who can read what) shows **zero** leaks.

## Briefing

Longform reading becomes social when the unit of conversation is small. A passage is the post; notes and replies are the thread; a chapter is a day's feed. The other half of the brief is what *not* to import from social media. Likes, streaks, infinite feeds and notification storms are the parts that work against M72.

Matching people's notes requires matching books. Titles lie and editions differ: match by file hash first. Anchors (M64) can carry notes across editions — label those "approximate".

The center of gravity is **explicit sharing at passage granularity**.

## The trap

1. **"Add likes."**
2. **Leaking private notes** through shared indexes or counts.
3. **Matching books by title.**
4. **Uploading the book** so others can read along.
5. **Moderation you can't provide.** Circles of strangers are a different product.

## The feature

- A data model: circle, membership, note visibility, replies.
- Storage with access rules (a shared database with rules, or your M75 server).
- Badges and threads in the reader.
- Share cards.
- A privacy test matrix.

## Decision map

1. **Visibility model.** Per note · per circle · per book.
2. **Storage.** Hosted shared database with rules · home server.
3. **Identity.** Accounts · device pairing · invite links.
4. **Cross-edition notes.** Hide · show as approximate.
5. **Notifications.** None · daily digest · per reply.

## Research targets

- **Privacy by design — 25 min.**
  **Done when:** you can show a private note is unreachable through every shared surface.
- **Access rules in your store — 45 min (deep).**
  **Done when:** you can write and test rules for circle membership.
- **Quotation norms and fair use — 25 min.**
  **Done when:** you can justify your quote cap.
- **Calm technology — 25 min.**
  **Done when:** you can name three features you will refuse to build.

## Out of scope

Public feeds, recommendation algorithms, likes and streaks, moderation tooling for strangers, direct messages.

## Measure ritual

**Numbers:** privacy leaks (must be **0**), time for a friend's note to appear, notifications per active day (keep it low on purpose).

## Hint ladder

<details><summary>Should notes from other editions appear?</summary>

**Orient:** what did the resolver use to place them?

**Approach:** show notes resolved by position, CFI or exact quote as normal; show fuzzy or neighbour-resolved notes with an "approximate" label; never show orphans in the passage thread.

</details>

## The slow walk

1. Write the privacy matrix first.
2. Margin badges (local, existing data).
3. Replies (local).
4. Share cards (local export).
5. Circles: storage rules, membership, invites.
   **Check:** privacy matrix passes.
6. Cross-edition labels.
7. Use it with two friends for a week; cut what got in the way.

## Prove it — the three rooms

- **Interview:** explain how a private note stays private in a shared circle.
- **Design review:** a growth-minded peer wants likes and streaks. Argue from M72 and your own week of use.
- **Meetup:** "We read a novel together a chapter a day — comments live on the paragraphs, nobody uploads the book, and there's nothing to like."

**Reach-backs:** M7 presence vs persistence · M64 · M70 · M72.
**Compare after:** REVIEW.md §13 and the social items in TODO.md (this one is ahead of the code).

---

<a id="m74"></a>
# M74 — Hostile Inputs, Measured · fuzzing, properties, differentials & heap checks · (M)

> **Story.** As the person responsible for parsing strangers' files, I want evidence — not hope — that no input panics the engine, exhausts memory or hangs the interface, and that what I fixed stays fixed.
>
> **MVP.**
> - A `Limits` structure enforced everywhere.
> - A mutation soak: real fixtures, randomly corrupted, pushed through every public API.
> - Coverage-guided fuzz targets for the parsers.
> - Property tests for invariants (round trips, idempotence).
> - Differential tests between two implementations.
> - Time budgets for hostile shapes.
> - A heap-snapshot leak check in end-to-end tests.
>
> **Acceptance criteria.**
> - 200,000 mutants run with **0 panics**.
> - Fuzz targets run nightly with a stored corpus.
> - Property and differential suites run in CI.
> - Hostile-shape timing tests assert a bound, not just "doesn't crash".
> - The leak check fails the build if a closed screen survives.

## Briefing

Each technique answers a different question:
- **mutation soaks:** do the real paths survive damage?
- **coverage-guided fuzzing:** what happens in deep parser states?
- **properties:** what must always hold?
- **differential tests:** do two implementations agree?
- **timing tests:** is the work bounded?
- **heap snapshots:** do lifetimes end?

None replaces the others. "No crash" is the weakest oracle; budgets for time and memory are what make a crash-free parser also a safe one.

The center of gravity is **oracles, not volume**.

## The trap

1. **Fuzzing only the top-level API.** Early validation rejects everything interesting.
2. **"No crash" as the only oracle.**
3. **Flaky time assertions.** Measure shapes with wide margins, in release and in debug.
4. **Mocks that remove the bug.**

## The feature

- `Limits` and its enforcement points.
- A mutation harness over a fixture corpus.
- `cargo fuzz` targets: PDF open + page text, EPUB open + chapter, CMap parse, CSS sanitize, link grammar.
- Property tests; differential vector generation (M67).
- Hostile-shape timing tests.
- The heap probe (M69).

## Decision map

1. **What to fuzz first.** Highest exposure × lowest test coverage.
2. **Seeds.** Real files · generated · structure-aware mutations.
3. **Oracles.** Panic · time · memory · invariant · differential.
4. **CI budget.** Per commit vs nightly.

## Research targets

- **cargo-fuzz — 25 min.**
  **Done when:** one target runs locally with a seed corpus.
- **Property-based testing — 25 min.**
  **Done when:** you have a shrinking failure for a planted bug.
- **Differential testing — 25 min.**
  **Done when:** you can explain why generated vectors beat hand-written ones for parity.
- **Heap snapshot retainers — 25 min.**
  **Done when:** you can count instances of a class in a snapshot programmatically.

## Out of scope

Formal verification, sanitizer builds for every target, symbolic execution.

## Measure ritual

**Numbers:** mutants per second, fuzz executions per second, coverage of parser code, findings per week (should trend to zero), and time-budget headroom on hostile shapes.

## Hint ladder

<details><summary>The fuzzer has found nothing in an hour</summary>

**Orient:** what fraction of inputs get past your first check?

**Approach:** if the harness rejects almost everything at the magic number or the ZIP signature, you are fuzzing the rejection. Seed with real files, mutate structure-aware (keep headers valid), and add targets below the top-level API.

</details>

## The slow walk

1. Write `Limits`; enforce it at every allocation that depends on input.
2. Build the mutation soak over 20 fixtures.
   **Check:** 0 panics.
3. Add two fuzz targets; then three more.
4. Add properties and differential vectors.
5. Add timing tests for hostile shapes.
6. Add the heap probe to end-to-end tests.
7. Schedule nightly runs; keep the corpus.

## Prove it — the three rooms

- **Interview:** explain which oracle caught which class of bug.
- **Design review:** a peer says "we have 90% line coverage". Ask about the oracles.
- **Meetup:** "My reader's parsers eat hundreds of thousands of corrupted files a night — and a test fails if a closed book stays in memory."

**Reach-backs:** M39 break/fix security · M61 · M67 · M69.
**Compare after:** `crates/marginalia/tests/robustness.rs`, tests in `crates/core/src/links.rs`, `app/scripts/*-test.ts`, `app/e2e/lib.mjs`.

---

<a id="m75"></a>
# M75 — The Library on a Raspberry Pi 5 · native engine, kiosk & home server · (L)

> **Story.** As a household reader, I want my library on a Raspberry Pi 5 that serves my phone and tablet, runs OCR quickly, and keeps files on hardware I own.
>
> **MVP.**
> - An arm64 build of the engine and CLI.
> - A measured kiosk setup (the existing web app in a full-screen browser).
> - A home server that serves documents by byte range, stores annotations in SQLite (WAL), and runs OCR jobs with all cores.
> - The web app gains a second storage implementation that talks to it.
> - LAN-only by default, with device pairing.
>
> **Acceptance criteria.**
> - A phone opens a 300-page PDF from the Pi using range requests, without the server loading the whole file.
> - OCR seconds per page are measured natively on the Pi vs in the phone's browser.
> - Notes made on two phones converge through the Pi.
> - Pulling the power mid-write loses at most the last write.
> - Nothing listens on the public internet by default.

## Briefing

A Pi 5 has four Cortex-A76 cores at 2.4 GHz and 1–16 GB of RAM. The engine needs no code changes to run there. The work is the **server boundary**: what the phone may ask for, who the phone is, what persists, and how the app's storage facade gains a second implementation without the UI noticing.

Three shapes, cheapest first:
1. **Kiosk:** zero code; a measurement.
2. **Home server:** the strong option.
3. **Native touchscreen app:** needs a non-HTML render model; see M76.

The center of gravity is **the household server boundary**.

## The trap

1. **Exposing it to the internet** "temporarily".
2. **Loading whole files per request.**
3. **Trusting the LAN.** Every device on your Wi-Fi is not you.
4. **SD-card wear and corruption.** Use WAL and prefer an SSD.
5. **Rewriting the UI** instead of adding a storage implementation.

## The feature

- Cross-compiled arm64 binaries and a CI job.
- A kiosk recipe with measurements.
- The server: documents (range), annotations (SQLite), OCR queue, pairing.
- The app's second `Library` implementation and a switch.

## Decision map

1. **Kiosk vs server vs native UI.**
2. **Authentication.** Pairing codes · passkeys · LAN-only trust (don't).
3. **Schema.** Mirror the IndexedDB stores · normalize.
4. **File access.** `ByteSource` with ranges.
5. **OCR scheduling.** Queue, concurrency, priority for visible pages.

## Research targets

- **aarch64 cross-compilation — 25 min.**
  **Done when:** CI produces a working arm64 binary.
- **SQLite WAL and durability — 45 min (deep).**
  **Done when:** you can explain what survives a power cut.
- **HTTP range requests — 25 min.**
  **Done when:** your server answers `Range` correctly, including invalid ranges.
- **LAN discovery (mDNS) — 25 min.**
  **Done when:** a phone can find the Pi without typing an IP — or you decide it shouldn't.

## Out of scope

Public hosting, multiple households, containers and orchestration, remote access tunnels.

## Measure ritual

**Numbers:** OCR seconds per page (native, 4 threads) vs phone WASM; server resident memory with 10 open documents; time to first page over Wi-Fi; sync latency between two phones; and how much is lost after a power-cut test.

## Hint ladder

<details><summary>Server memory spikes when phones open big PDFs</summary>

**Orient:** what does one request read from disk?

**Approach:** if the engine opens the whole file per request, you've rebuilt the browser's original problem on the server. Serve file bytes by range directly from disk, and give the engine a random-access `ByteSource` so it reads only the objects a page needs.

</details>

## The slow walk

1. Build for arm64; run the CLI benchmarks on the Pi.
2. Kiosk: measure; decide if it's enough.
3. Server skeleton: health, pairing.
4. Documents by range.
5. Annotations in SQLite; sync endpoints.
6. The app's second storage implementation.
   **Check:** two phones converge.
7. OCR queue; measure; power-cut test.

## Prove it — the three rooms

- **Interview:** narrate a phone opening a page from the Pi and saving a note, naming every boundary.
- **Design review:** "just put it on a cloud VM" — compare privacy, cost, latency and failure modes.
- **Meetup:** "My family's books live on a Raspberry Pi; phones read them over Wi-Fi and the Pi does the OCR."

**Reach-backs:** M2 PostgreSQL (contrast) · M50 networking lab · M70 · M66.
**Compare after:** REVIEW.md §12 (Raspberry Pi 5); `crates/cli` as a starting point.

---

<a id="m76"></a>
# M76 — A Book in 8 MB · an ESP32-S3 e-ink reader with synced notes · (XL)

> **Story.** As a maker, I want a pocket e-ink reader built on an ESP32-S3 that opens EPUBs from an SD card, lets me highlight a sentence, and syncs notes with the app, so that the engine's portability claim is proven on the smallest honest target.
>
> **MVP.**
> - An esp-rs build of the engine core and the EPUB reader (std via ESP-IDF).
> - Random-access reading from SD (`ByteSource`); one chapter at a time.
> - A non-HTML render model → line layout → pagination; glyph atlases.
> - Tap-to-select by word, sentence or paragraph.
> - An append-only note log on flash, synced over Wi-Fi to the M75 Pi.
> - PDFs arrive as pre-rendered "page packs" made on the Pi.
>
> **Acceptance criteria.**
> - A 5 MB EPUB opens with under 2 MB of PSRAM at peak.
> - A page turn, including the e-ink refresh, takes under your budget (e.g. 600 ms).
> - Notes made on the device appear in the app on the same passages (same anchors).
> - A hostile EPUB is refused politely, not with a reboot.
> - The firmware fits in your flash budget (e.g. < 2 MB).

## Briefing

An ESP32-S3 has two cores at 240 MHz and 512 KB of internal SRAM, with boards commonly adding 2–8 MB of PSRAM and 8–16 MB of flash. A 960×540 e-paper framebuffer at 4 bits per pixel is ≈253 KB. Every budget you wrote in earlier modules becomes literal here.

The work is mostly **subtraction and streaming**:
- **Remove:** the PDF engine, OCR, HTML rendering.
- **Stream:** the ZIP, the chapter, the layout.
- **Add:** a render model so a host without a browser can lay out text whose offsets still match the engine's projection — so anchors, notes and links are the same everywhere.

The center of gravity is **a memory budget you can read off a datasheet**.

## The trap

1. **Porting the browser architecture.** There is no DOM to sanitize into.
2. **Holding the archive in RAM.**
3. **Rasterizing TrueType per glyph per page.** Cache, or precompute atlases.
4. **Live handle-dragging on e-ink.** A partial refresh takes a few hundred ms; design taps instead.
5. **Parsing PDFs on the device.**
6. **Starting with `no_std`** before measuring what `std` on ESP-IDF costs.

## The feature

- A cargo feature that removes PDF from the engine facade.
- `ByteSource` over the SD card; central directory only in memory.
- A render model: blocks and inline runs with text offsets.
- Greedy line breaking and pagination per chapter.
- Glyph atlases in flash, or a rasterizer with a PSRAM cache.
- Tap selection; a note log; Wi-Fi sync.
- Page packs for PDFs, produced on the Pi.

## Decision map

1. **`std` (ESP-IDF) vs `no_std` (esp-hal).**
2. **Board and display.**
3. **Fonts.** Atlases · runtime rasterization with a cache.
4. **Line breaking.** Greedy · Knuth–Plass.
5. **Selection gestures.** Word · sentence · paragraph.
6. **Sync transport.** Wi-Fi to the Pi · BLE to a phone.
7. **What is precomputed off-device.**

## Research targets

- **ESP32-S3 memory map and PSRAM — 45 min (deep).**
  **Done when:** you can say which allocations go where, and why the framebuffer lives in PSRAM.
- **The esp-rs toolchain — 25 min.**
  **Done when:** `core` + `epub` cross-compile for `xtensa-esp32s3-espidf`.
- **E-ink waveforms and partial refresh — 25 min.**
  **Done when:** you can budget a page turn.
- **UAX #14 line breaking — 25 min.**
  **Done when:** you can break a paragraph with an em dash and a URL correctly.
- **Bitmap fonts — 25 min.**
  **Done when:** you can estimate an atlas's flash size for a Latin subset at three sizes.

## Out of scope

PDF parsing, OCR, color, audio, a CSS engine, a general-purpose UI toolkit.

## Measure ritual

**Numbers:** heap high-water mark per operation (open book, open chapter, layout, page turn, save note), flash size, time to first page, page-turn latency, and battery use per 100 pages.

## Hint ladder

<details><summary>The chapter opens, then memory runs out during layout</summary>

**Orient:** how many representations of the chapter exist at the peak?

**Approach:** if you hold the source XHTML, the sanitized output, a tree, the text and the laid-out lines at once, you have five copies. Emit the render model while parsing, drop the source as you go, lay out one page ahead, and keep only line metadata for pages behind.

</details>

<details><summary>Notes from the device land a word off in the app</summary>

**Orient:** is the device's text projection identical to the engine's?

**Approach:** the render model must carry offsets into the *same* projection (M60), produced by the same sanitizer rules (M62). Run the projection on both hosts for the same chapter and diff them.

</details>

## The slow walk

1. Cross-compile `core` for the target; print a version over serial.
2. Add the EPUB reader behind a no-PDF feature; open a book from SD.
   **Check:** heap high-water mark.
3. Emit the render model; print paragraphs over serial.
4. Lay out and paginate; draw to e-ink with an atlas.
5. Tap selection; save a note to flash.
6. Sync notes to the Pi; see them in the app.
7. Page packs for PDFs from the Pi.
8. Measure battery over 100 pages.

## Prove it — the three rooms

- **Interview:** walk through the memory budget of a page turn.
- **Design review:** a peer wants to run a browser engine on the device. Compare the datasheet to their plan.
- **Meetup:** "The same anchors and notes as my web reader — on an ESP32-S3 with an e-ink screen and 8 MB of PSRAM."

**Reach-backs:** M32 constrained hardware · M49 carry more than a packet (books over Reticulum, if you're feeling brave) · M60 · M61 · M75.
**Compare after:** REVIEW.md §12 (ESP32-S3 plan).

---

<a id="m77"></a>
# M77 — Ship It Small · split bundles, strict CSP & publishing · (M)

> **Story.** As the maintainer, I want the app to ship as a small static bundle that works under a strict Content Security Policy inside a sandboxed host, with heavy parts loaded only when needed and old pages noticing new deploys.
>
> **MVP.**
> - The engine is split into a reader build and an OCR build loaded only for scans; models load on demand.
> - Base64 fallbacks for binary types a host refuses to serve; escaping of control bytes in text assets.
> - Hashed file names; stale-build detection with a reload prompt.
> - A written note on what a shared host can see.
>
> **Acceptance criteria.**
> - First load for an EPUB-only session stays within your byte budget.
> - The OCR engine is not downloaded until a scan is opened.
> - The app works under `script-src 'self' 'wasm-unsafe-eval'` with no `eval`.
> - A page left open across a deploy detects missing files and offers to reload.
> - The publish script is reproducible.

## Briefing

Hosts have rules — content types they will serve, policies they enforce, sandboxes they impose — and users have budgets. Shipping small means:
- splitting at the boundaries your users actually cross: reading vs scanning;
- deferring what most sessions never need;
- making version skew a handled case (M71) rather than a mystery.

The center of gravity is **paying only for what this session uses**.

## The trap

1. **One giant WASM** with OCR inside.
2. **Dependencies that `eval`.** Check your PDF renderer's options.
3. **Deleting old assets** while pages are open, without detection.
4. **Binary types the host won't serve**, discovered at publish time.

## The feature

- Two WASM builds and lazy loading.
- On-demand models with a fallback encoding.
- A publish script: control-byte escaping, file maps, content types.
- Stale-build detection wired to M71's notices.
- A CSP test.

## Decision map

1. **Split points.** Reader · OCR · PDF renderer.
2. **Compression and caching.**
3. **Fallback encodings.**
4. **What a shared host can see**, and what you tell users.

## Research targets

- **CSP and `wasm-unsafe-eval` — 25 min.**
  **Done when:** your app runs under the strict policy with zero violations.
- **Code splitting and lazy WASM — 25 min.**
  **Done when:** the network panel shows the OCR build only after a scan opens.
- **Content types and hosting constraints — 25 min.**
  **Done when:** you know what your host will and won't serve.

## Out of scope

Service workers and offline install (park it), CDNs, app stores.

## Measure ritual

**Numbers:** bytes before first paint, time to interactive on a mid-range phone, bytes for an EPUB-only session vs a scan session, and CSP violations (must be **0**).

## Hint ladder

<details><summary>Publishing fails on a binary file type</summary>

**Orient:** which content types does the host serve?

**Approach:** publish a text encoding of the file (base64 with a known suffix) alongside, and teach your fetch helper to try the raw path first and the encoded path second. Escape raw control bytes in JavaScript assets as `\xHH` inside string literals.

</details>

## The slow walk

1. Measure the current bundle; write the budget.
2. Split the engine; lazy-load OCR and models.
3. Run under a strict CSP; fix violations.
4. Build the publish script; publish once.
5. Leave a page open, publish again, and watch it detect the change.
6. Write the hosting note for users.

## Prove it — the three rooms

- **Interview:** explain your split points and their measured savings.
- **Design review:** a peer bundles everything "for simplicity". Show the first-paint numbers.
- **Meetup:** "The reader engine is 1 MB gzipped; OCR loads only when you open a scan, and the whole thing runs under a strict CSP."

**Reach-backs:** M55 ship the client site · M66 · M71.
**Compare after:** `scripts/build-wasm.sh`, `app/scripts/artifact.mjs`, `app/src/ui/fetch.ts`.

---

<a id="source-shelf-volume-iv"></a>
# Source shelf for Volume IV

These are **seed sources**, not answer keys. Read only enough to close the module's done-when. Links current as of October 2026.

## Formats

- EPUB 3.3: https://www.w3.org/TR/epub-33/
- EPUB Reading Systems 3.3: https://www.w3.org/TR/epub-rs-33/
- EPUB Canonical Fragment Identifiers: http://www.idpf.org/epub/linking/cfi/epub-cfi.html
- PDF 2.0 (ISO 32000-2) — available at no cost through the PDF Association (pdfa.org)
- Unicode UAX #29 (text segmentation): https://www.unicode.org/reports/tr29/
- Unicode UAX #14 (line breaking): https://www.unicode.org/reports/tr14/

## Anchoring and annotation

- W3C Web Annotation Data Model: https://www.w3.org/TR/annotation-model/
- Hypothesis — Fuzzy anchoring: https://web.hypothes.is/blog/fuzzy-anchoring/
- Bitap algorithm: https://en.wikipedia.org/wiki/Bitap_algorithm
- diff-match-patch: https://github.com/google/diff-match-patch

## Rendering, selection and the browser

- pdf.js: https://mozilla.github.io/pdf.js/
- Using shadow DOM: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM
- Pointer Events: https://www.w3.org/TR/pointerevents/
- `touch-action`: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- `caretPositionFromPoint`: https://developer.mozilla.org/en-US/docs/Web/API/Document/caretPositionFromPoint
- `Intl.Segmenter`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter
- Heap snapshots in Chrome DevTools: https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots

## Persistence and sync

- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- `IDBTransaction` (lifetime and auto-commit): https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction
- `StorageManager.persist()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- Ink & Switch — Local-first software: https://www.inkandswitch.com/local-first/
- Kulkarni et al., *Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases* (2014) — hybrid logical clocks
- SQLite write-ahead logging: https://www.sqlite.org/wal.html
- HTTP range requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests

## Engine boundaries and proof

- The Rustonomicon — FFI: https://doc.rust-lang.org/nomicon/ffi.html
- `std::panic::catch_unwind`: https://doc.rust-lang.org/std/panic/fn.catch_unwind.html
- wasm-bindgen: https://github.com/wasm-bindgen/wasm-bindgen
- Rust Fuzz Book — cargo-fuzz: https://rust-fuzz.github.io/book/cargo-fuzz.html
- proptest: https://github.com/proptest-rs/proptest

## OCR

- ocrs: https://github.com/robertknight/ocrs
- Tesseract: https://github.com/tesseract-ocr/tesseract · tesseract.js: https://github.com/naptha/tesseract.js
- PaddleOCR: https://github.com/PaddlePaddle/PaddleOCR

Compare engines by license as well as accuracy; some excellent models carry terms that rule out commercial use.

## Attention and accessibility

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Weiser & Brown, *Designing Calm Technology* (1995)

Read research on reading aids critically and make no medical claims; your users' notes from M72 are the evidence that matters for your app.

## Small hardware

- Raspberry Pi 5: https://www.raspberrypi.com/products/raspberry-pi-5/ · documentation: https://www.raspberrypi.com/documentation/
- ESP32-S3: https://www.espressif.com/en/products/socs/esp32-s3
- The Rust on ESP Book: https://docs.esp-rs.org/book/
- esp-hal: https://github.com/esp-rs/esp-hal · esp-idf-svc: https://github.com/esp-rs/esp-idf-svc
- Knuth & Plass, *Breaking Paragraphs into Lines* (1981)

---

<a id="campaign-ordering-volume-iv"></a>
# Campaign ordering suggestions

Built in order, M60–M77 compose into the whole product. Five shorter campaigns:

### The engine core
**M60 → M61 → M62 → M64 → M66 → M67**

Text contract, container, sanitizer, anchors, one contract for every host, and a grammar you can prove. Everything else stands on this.

### The PDF descent
**M60 → M63 → M65 → M64**

From painted glyphs to selectable, recognizable, re-anchorable text.

### The reader
**M68 → M69 → M70 → M71 → M77**

Own the selection, budget the screen, keep the notes, survive the failures, ship it small.

### People
**M72 → M73**

Attention first, then company. Do not reverse this order.

### Small hardware
**M66 → M69 → M75 → M76**

One contract, budgets you can prove, then a Pi in the house and a book in 8 MB.

**M74 runs alongside every campaign.** Add its oracles as each module lands; don't save proof for the end.

---

<a id="closing-test-volume-iv"></a>
# Volume IV closing test

At the end, take a blank page and answer these without notes:

1. **What is "the text" of a page, and in which unit do you count it?**
2. **Which bytes are resident right now, and why each of them?**
3. **What does the engine promise every host, and what does each host translate?**
4. **Which inputs are hostile, and what bounds each one?**
5. **Where does an anchor go when the text changes — and when does it refuse to go anywhere?**
6. **What is the unit of work for saving a note?**
7. **What happens, step by step, after the engine crashes?**
8. **When focus mode is on, what does the reader stop seeing, and what must stay visible?**
9. **What is shared, with whom, and by whose action?**
10. **What would you delete to fit the reader into 8 MB, and what would you refuse to delete?**

If you can answer those across these eighteen modules, Volume IV has done its job.
