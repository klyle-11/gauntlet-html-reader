# Ground Floor review

I read all 59 Ground Floor sections: M1–M46 in `0 The_Gauntlet_Complete.md` and M47–M59 in `The_Gauntlet_III.md`, about 43,000 words. I checked them in two ways: by reading every section, and by running scripts over the parsed text. The scripts checked structure, length, every cross-reference to another module's Ground Floor, and every "That's M_'s Nth decision" or "Nth trap" claim against the actual decision map and trap.

## Verdict

The sections are in very good shape. They follow one template almost without exception, they build up from one module to the next, and none of them gives away the module's answer or any code. I found three factual errors, two of them in cross-references. The main real issue is uneven depth: about a fifth of the steps only tell you what to look up, with nothing to do or answer.

| Check | Result |
|---|---|
| Every I/II/III module has a Ground Floor, placed right before the Briefing | 59 / 59 |
| Template: picture → steps → run and observe → hand-off table → check yourself | 54 / 59 (deviations in §2) |
| "That's M_'s Nth decision" points at the right decision | 43 / 43 |
| "That's M_'s Nth trap" points at the right trap | 20 / 20 |
| "M_'s Ground Floor covered/touched X" is actually true | All but 2 (§1) |
| Code blocks that contain code instead of diagrams | 0 |
| A Ground Floor settles a decision the module leaves open | 0 (§4) |

---

## 1. Must fix: factual errors

**M14, GF.3:** "`timestamptz` in Postgres (M2's Ground Floor touched it)". M2's Ground Floor never mentions timestamps. Its hand-off table says "Timestamps not considered", and leaves the choice to the M2 module itself.

> **Look up:** `timestamp` vs `timestamptz` in Postgres (M2 had you choose how time is stored); `INSERT` as an append-only pattern; and returning 201 Created vs 200 OK vs 202 Accepted.

**M56, GF.3:** "a modular type scale (M44's Ground Floor touched it)". M44's Ground Floor only hands the type scale off to the module ("A few font sizes → Choose a type scale"). It never explains what a modular scale is.

> …measure (line length), leading, and tracking; and a modular type scale (M44 had you choose one).

**M46, intro:** it lists M7, M19 and M45 as prerequisites, but the loop it uses is M17's `requestAnimationFrame` with delta time (GF.3 says so), not M19's C terminal loop.

> *…It assumes M7, M17, and M45's Ground Floors: a broadcast socket, a frame loop with delta time, and the idea of a CRDT. M19's game loop helps too…*

## 2. Consistency

Nearly every section follows the same shape, uses the same headings, and ends with the same check-yourself step. These are the exceptions:

| Where | What differs | Recommendation |
|---|---|---|
| **M35** | The only Ground Floor with no "Run it and observe" step and no "Notice and leave alone" list | Add one (text below) |
| **M1** | 7 check-yourself questions (everywhere else has 5). GF.9 says "Two things to notice and **not fix yet**" instead of the standard heading. Observing comes before the React build | Keep the length: M1 is the gateway. Rename the GF.9 lead-in to **Notice and leave alone:** |
| **M3, M5** | Build steps come after "Run it and observe" (GF.7 typed client; GF.6–7 cancellation and Observables) | Fine as teaching order. Optionally add one notice to the late steps so nothing built goes unobserved |
| **M18** | Observing is folded into GF.6 "Meet the four bugs on purpose" | Fine as is |
| **M35, M55, M56** | The intro has no "never how to write it" clause (it fits less well for proofs and design) | Optional, for parity: "…never what to make" / "…never how to prove it" |
| **Volume III** | Ends with "…and draw your Boundary Map before building" | Intentional: the volume intro defines the Boundary Map. No change |

**M35, a "Run it and observe" step that gives nothing away.** Insert it as GF.7, and renumber the hand-off to GF.8 and check-yourself to GF.9:

> #### GF.7 — Run it and observe
>
> **Notice and leave alone:**
>
> 1. **Test "n² + n + 41 is prime for every natural number n"** for n = 0 through 10. Does it hold every time? Does that prove it? Don't look further yet. That's M35's trap.
> 2. **Your two truth tables from GF.2.** What would their matching columns let you do in a proof? Don't use it yet. That's M35's first decision.
> 3. **List three "for every n" facts you've relied on in code,** such as a loop that always ends or a sum formula. What do they have in common? That's the second decision.
> 4. **Your "obvious" step from GF.6.** That's the fifth decision.

## 3. Depth

There's a clear gradient. M1 is about 1,750 words with 12 steps and 13 look-up prompts, and M2 is about 1,100. Everything after M2 runs 550–900 words with 7–10 steps. That's fine as a design, since M1 teaches the format itself. Within the shorter sections, though, depth varies in two ways:

- **About 55 of the 263 content steps (about 20%) are look-up only:** nothing to do, build or answer. They pile up in M22, M26, M45, M53 and M57 (three each) and in M25, M32, M34, M44, M48, M51, M52, M55 and M56 (two each).
- **38 of 59 sections have no "Question to settle".** M1–M7 use them often, and from M8 on they mostly disappear.

The cheapest fix is one line per thin step: a **Do** or a **Question to settle**. None of the lines below hands over an answer or settles a decision:

| Step | Add |
|---|---|
| M22 GF.2 PHP, the first hour | **Do:** from the command line, run a scratch PHP file that uses one array as a list and another as a map, and print one value from each. |
| M25 GF.3 Paths and metadata | **Do:** print the `stat()` results for a file, a folder, and your GF.2 symlink, with and without following the link. Which fields change? |
| M26 GF.2 Forms, from zero | **Do:** submit a plain HTML form with no JavaScript and watch the Network tab. What method and `Content-Type` went out, and what happened to the page? |
| M30 GF.4 Autoplay policy | **Question to settle:** why would a browser let a page play muted video on load, but not sound? |
| M31 GF.2 Processes | **Do:** count Chrome's processes in your OS's task manager, open one new tab, and count again. |
| M32 GF.4 Buses | **Do:** from your board's pinout, write down its default I2C and SPI pins. |
| M34 GF.2 Sockets and ports | **Do:** take one request from DevTools or `curl -v` and write out its 4-tuple. |
| M44 GF.5 Styles and variables | **Question to settle:** how many different blues are on a site you use every day? How would anyone change all of them at once? |
| M45 GF.2 Local-first | **Question to settle:** which of the seven ideals does a typical cloud notes app give up, and which does your GF.3 page already meet? |
| M52 GF.4 Transactions in Psycopg | **Question to settle:** your route only runs a `SELECT`. Is a transaction open afterward, and how would you find out? |
| M53 GF.4 Text, three ways | **Do:** on any page, compare `textContent` and `innerText` for one element that contains a hidden child and a `<br>`. |
| M55 GF.4 The basics | **Do:** run Lighthouse on a local business's site and note its lowest category and the top reason why. |
| M56 GF.4 Grids | **Do:** draw a column grid over a screenshot of a magazine page and find one place it breaks the grid on purpose. |
| M57 GF.2 Layer order | **Do:** on paper, list your figure's layers back to front and mark every pair that could ever overlap. |

I wouldn't pad the shorter sections beyond this. Their run-and-observe steps are consistently the strongest part. Each notice is a concrete experiment that ends with "That's M_'s Nth decision", and all 43 of those references are correct.

## 4. The "no answers, no code" rule

**No code anywhere.** Every code fence in the 59 sections is a diagram. The throwaway builds use a different domain from the real feature (books for incidents, a door for a work order, an org chart for a BOM, a thermometer for a machine, a guestbook for notes), so building the throwaway doesn't build the module.

**No decision settled early.** Some hand-off rows read like verdicts: M16 "Prepare once; rerun only the cheap layout", M26 "Newest-first from the query", M41 "Parse the response JSON with `jq`", M46 "Put presence in awareness…", M51 "DTOs define the public contract", and M57 "One canonical character model". I checked each one against its module, and every one restates that module's own Story acceptance criteria, Feature or Trap. They're requirements, not answers to the decision map. The same goes for hints that look strong (M6, M19, M27, M31, M43): each module's own research targets or hints already say the same thing.

**One optional nit, M28 GF.1.** The picture lists which CSS properties are cheap to animate (`transform`, `opacity`) and which are costly. That pre-answers M28's research target, whose done-when is "name which properties are cheap and why", before you've looked it up. A softer version:

> Some properties are cheap to change, and some make the browser redo layout and paint. Which are which is GF.4's look-up.

---

*All of these checks ran against the parsed sources, so they can be re-run after edits. A doc-lint step that fails the build on a broken "M_'s Nth decision" or "M_'s Ground Floor" reference would be a small addition.*
