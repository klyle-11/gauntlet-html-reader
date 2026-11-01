# The Gauntlet VII — Steward: PHP & WordPress for the Sites You Keep

## Five builds that add up to a maintenance practice for client WordPress sites — modern PHP, a plugin that passes review, secrets you can rotate, patches that beat the attacker's clock, and the business that pays for all of it

This volume continues the numbering from *The Gauntlet VI*. It assumes the same operating manual:

> **You do all implementation yourself. This file gives you the problem, the questions, the tradeoffs, the fences, and the proof — not the implementation.**

M22 taught one WordPress feature built the update-safe way. M39 taught you to break and fix your own endpoint. M55 shipped a client site. This volume is what comes *after* the launch: the years in which someone has to keep a WordPress site patched, its secrets private and its owner informed, while the rest of the internet probes it at machine speed.

Volume VII is one product, **Steward**: a small toolkit and a practice for a freelancer or a three-person agency that looks after a handful of client sites. Every module is a piece of it. Built in order, the modules compose; built à la carte, each still stands alone.

The center of gravity is **boundaries you are paid to hold**:

- your code vs the client's site,
- one request vs the worker that serves the next one,
- input vs the place where it gains meaning,
- a secret vs everyone who can read the file it lives in,
- a published patch vs the attacker's clock,
- an update you trust vs an update that was poisoned upstream,
- what you promised in writing vs what you can actually do at 2 a.m.

The anti-rabbit-hole protocol still applies unchanged: **25-minute default research boxes, 45-minute deep boxes, explicit done-whens, one-line parking-lot entries, and hard out-of-scope fences.** If a research thread does not change a decision you must make in the current module, park it.

### Why this volume, why now

Three things changed between M22 and this volume, and they change the job:

1. **Discovery got cheap.** In 2026, researchers reported finding hundreds of critical WordPress plugin vulnerabilities in days with AI pipelines, at roughly the price of a sandwich each; a chained WordPress core exploit (*wp2shell*, July 2026) and two critical PHP engine bugs (*PHP2Shell*, October 2026) were both found with AI assistance. The time between a patch and mass exploitation is now measured in hours.
2. **Updates became an attack path.** Several 2026 incidents shipped backdoors *through* the normal update channel — a bought or hijacked plugin listing, a compromised premium build pipeline, rewritten Composer tags. "Always update immediately" is no longer a complete policy.
3. **Secrets multiplied.** WordPress 7.0 ships a provider-agnostic AI Client, so client sites now hold AI provider keys next to database passwords. Public leak counts of AI-service credentials rose sharply in 2025, and AI coding tools appear in the leak statistics too.

The companion book, *PHP and WordPress for Durable Client Work*, explains the mechanisms and the incidents in prose. This volume makes you build against them.

<a id="fences-volume-vii"></a>
## Fences for this volume

- **Your sites only.** Local installs, sites you own, or client sites with *written* authorization naming the site and the work. No scanning, probing or "just checking" anyone else's site, ever.
- **No public exploit code.** You read advisories; you do not download or run proof-of-concept exploits for wp2shell, PHP2Shell or anything else. This volume is patch, detect and recover — reproduction of exploitation is out of scope.
- **Planted indicators are inert.** When a module asks you to "compromise" a disposable copy of your own site, you plant harmless markers you wrote yourself: a marker file, a test administrator, a one-line edit. No real malware, no downloaded samples.
- **Real secrets never enter fixtures, screenshots, commits, tickets or prompts.** Every test secret is generated, obviously fake (prefix it `FAKE_`), and rotated anyway.
- **AI assistants are allowed and disclosed.** You own every line you ship. Client data and client secrets never go into a prompt.

> **A site you keep is a promise with a clock on it: every secret has a blast radius, every patch has a deadline, and every promise has a price.**

---

## Table of contents

### Orientation

- [Fences for this volume](#fences-volume-vii)
- [How to run this volume](#how-to-run-volume-vii)

### Modules

**The toolkit**
- [M78 — PHP That Reads Like 2026 · modern PHP, Composer & static analysis · (M)](#m78)
- [M79 — A Plugin That Passes Review · REST, PHP-only blocks, WPCS & Plugin Check · (L)](#m79)

**The defense**
- [M80 — Secrets Have a Blast Radius · wp-config, environment, AI keys & rotation · (M)](#m80)
- [M81 — Patch Day at Machine Speed · update pipeline, supply chain & incident drill · (L)](#m81)

**The practice**
- [M82 — The Practice · scoping, care plans, handover, CRA & team conventions · (M)](#m82)

### Reference and sequencing

- [Source shelf for Volume VII](#source-shelf-volume-vii)
- [Campaign ordering suggestions](#campaign-ordering-volume-vii)
- [Volume VII closing test](#closing-test-volume-vii)

---

<a id="how-to-run-volume-vii"></a>
## How to run this volume

Each module uses the same twelve-part shape as the earlier volumes: **Story · Ground Floor · Briefing · Trap · Feature · Decision map · Research targets · Fence · Measure ritual · Hint ladder · Slow walk · Prove it.**

You need a small **fleet**: three disposable local WordPress sites (call them `alpha`, `beta`, `gamma`) built with whichever local tool you used in M22 — `wp-env`, DDEV, Local, Docker Compose or WordPress Studio. Give them different plugin sets and at least two different PHP versions. They are your clients for the whole volume. Never point Steward at a site that is not on this list.

Keep two extra notebook pages per module.

**Trust Ledger** (new). One row per credential the module touches: what it unlocks, where it is stored, who and what can read it, how you would rotate it, how long rotation takes, and what breaks when you do. A secret without a row is a secret you will forget to rotate.

**Clock Sheet** (new). One row per risk the module handles: how fast it can hurt you (time from disclosure to exploitation, time from compromise to discovery) against how fast you can respond (time to patch, to restore, to tell the client). If your column is longer than the attacker's, write down what closes the gap.

> **If you cannot say how long rotation or patching takes, you have not measured it — and the client is paying for a guess.**

Each module ends with **Reach-backs** to the earlier volumes. Re-read the reached-back module's Prove-it before you start; it is the floor this module stands on.

---
<a id="m78"></a>
# M78 — PHP That Reads Like 2026 · modern PHP, Composer & static analysis · (M)

> **Story.** As a freelancer who keeps several client WordPress sites, I want a small command-line tool written in modern, strictly typed PHP that reports exactly what each site is running, so that every later decision — what to patch, what to rotate, what to charge — starts from facts instead of memory.
>
> **MVP.** `steward inventory <path>` reads a WordPress directory *without booting WordPress and without executing any of its files* and prints a typed inventory as JSON: core version, PHP and database requirements, every plugin and theme with its declared version and requirements, must-use plugins, and drop-ins. It ships as a Composer package with PSR-4 autoloading, runs under PHPStan at its maximum level, and has tests against fixture sites.
>
> **Acceptance criteria.**
> - The tool never `include`s, `require`s or `eval`s a file from the site it inspects.
> - Two runs over the same directory produce byte-identical JSON.
> - Every value in the output has a declared type; nothing leaves the tool as an untyped associative array.
> - PHPStan passes at the maximum level with no baseline file.
> - A malformed plugin header produces a reported warning, not a crash and not a silent omission.

## Ground Floor — PHP as it is written now

*Read this before the Briefing. It assumes M22's Ground Floor (you've run PHP on the command line and written a throwaway plugin) and comfortable TypeScript or Java, but not that you've written PHP with types, Composer, or a static analyser. You'll build a throwaway Composer project and watch the type system work first. This tells you what each piece is for and what to look up, never how to write it. The value objects, the parser, the output schema and the error model are the module's.*

### GF.1 — The picture first

```
a request (FPM / mod_php)              a CLI run (your tool)
──────────────────────────             ─────────────────────
worker takes request                   php bin/steward inventory ./alpha
  ├─ fresh globals, fresh objects        ├─ vendor/autoload.php  (Composer)
  ├─ your code runs                      ├─ classes load on first use (PSR-4)
  └─ everything is thrown away           ├─ one long run, then exit
      …the WORKER lives on               └─ exit code is your contract
         and serves the next request

types:   declare(strict_types=1)  → "1" is not an int at YOUR call sites
arrays:  one structure = list AND map, copied on write (value semantics)
objects: handles — passing one shares it (like JS)
```

### GF.2 — The modern toolchain

**Look up:** Composer (`composer init`, `require`, `require-dev`, `composer.lock`, the `autoload.psr-4` key, `bin` scripts); PSR-4; and what `vendor/autoload.php` actually does on the first `new` of a class.

**Do:** make a Composer project with one namespaced class and a `bin/` script that prints something from it. Delete `vendor/`, run `composer install`, and run it again.

### GF.3 — Types that bite

**Look up:** `declare(strict_types=1)` and exactly which calls it affects; union and nullable types; `never`, `mixed` and `void`; enums (pure and backed); `readonly` properties and classes; constructor promotion.

**Do:** write one function that takes an `int`. Call it with `"5"` with and without `strict_types` in the *calling* file. Then write a backed enum and call `::from()` and `::tryFrom()` with a bad value.

### GF.4 — What 8.4, 8.5 and 8.6 added

**Look up**, as vocabulary: PHP 8.4's property hooks, asymmetric visibility (`public private(set)`), `new` without wrapping parentheses, `array_find` and `array_any`, and `#[\Deprecated]`; PHP 8.5's pipe operator `|>`, `clone with`, `#[\NoDiscard]`, `array_first`/`array_last`, and the new URI extension; and PHP 8.6's partial function application, as an idea (8.6 is scheduled for general availability on 19 November 2026).

**Question to settle:** which PHP versions are still receiving security fixes today, and on what date does the oldest of them stop? Write the date on your Clock Sheet.

### GF.5 — The static analyser

**Look up:** PHPStan's levels and what changes between them; `phpstan.neon`; generics in PHPDoc (`@param list<Plugin>`, `array<string, Theme>`); and why a baseline file can hide new problems.

**Do:** run PHPStan at level 0 and then at max on your throwaway project. Add a function that returns `array` and read what max says.

### GF.6 — Reading a WordPress install as data

**Look up:** where WordPress declares its own version (`wp-includes/version.php`), how plugin and theme headers are written (the comment block at the top of the main plugin file and `style.css`), what lives in `wp-content/mu-plugins`, and what a drop-in is (`object-cache.php`, `advanced-cache.php`, `db.php`).

**Do:** open `version.php` from one fleet site in a text editor. Open three plugin main files and one theme's `style.css` and copy their headers into a scratch file.

### GF.7 — Run it and observe

**Notice and leave alone:**

1. **`version.php` is PHP code, not data.** What would happen if your tool read it the easy way, with `include`? Who wrote that file, as far as your tool can prove? That's M78's trap.
2. **Your three plugin headers.** Are they formatted the same? Where does one stop and the code begin? That's M78's second decision.
3. **Compare `6.9.5`, `7.0`, `7.0.2` and `7.0-RC1`.** Which is newest, and does `version_compare()` agree with you? That's the third decision.
4. **Picture a plugin whose header says `Version: 2.0.0` while its readme says `Stable tag: 1.9`.** Which one is "the version"? That's the fourth decision.
5. **Your PHPStan run at max.** What did it say about `array`? That's the first decision.
6. **A folder in `wp-content/plugins` with no PHP file inside.** Error, warning, or nothing? That's the fifth decision.

### GF.8 — Hand-off: what's yours in M78

| Ground Floor left this… | M78 asks you to… |
|---|---|
| A throwaway Composer project | A real package with PSR-4 autoloading and a `bin/steward` entry point |
| Functions that returned `array` | Decide arrays vs value objects for the inventory |
| Headers copied by hand | A header parser that never executes the file it reads |
| `version_compare` surprised you | Decide how versions are compared and stored |
| Two disagreeing versions, imagined | Decide which source of a version wins, and say so in the output |
| A folder with nothing in it | Decide the error model: exceptions, warnings, or result objects |
| PHPStan at max on a toy | PHPStan at max with no baseline on the real tool |

Then read the Briefing below, and fill in your Trust Ledger and Clock Sheet before building.

### GF.9 — Check yourself before moving on

- What does `strict_types` change, and in which file does it have to be declared to affect a call?
- Why is a PHP array passed to a function a copy, while an object passed to a function is not?
- What does Composer's autoloader do the first time you write `new Steward\Inventory\Plugin(...)`?
- Name two features from PHP 8.4 and two from 8.5.
- Why is `include 'version.php'` a security decision and not just a convenience?

## Briefing

Everything Steward does later depends on knowing what a site runs. A patch decision needs the exact plugin version; a rotation needs to know which plugins hold keys; a care-plan price needs to know how many moving parts there are. The inventory is the module everything else reads.

It is also your first piece of **modern PHP**, and the language has moved a long way from the PHP of tutorials and old plugins. Since 8.0 it has union types, enums, readonly classes, attributes, named arguments and `match`; 8.4 added property hooks and asymmetric visibility; 8.5 added a pipe operator and a standards-based URI parser. With `strict_types`, a static analyser at its maximum level and Composer, PHP reads and fails much more like the typed languages you know — *if* you write it that way.

There is a security lesson hidden in a tool this small. WordPress keeps its version in a PHP file, and the "easy" way to read a PHP file is to run it. A maintenance tool that executes files from the sites it inspects has handed every one of those sites a way to run code on the maintainer's machine — next to the maintainer's SSH keys and every client's credentials. Inventory is **reading**, never executing.

The center of gravity is **facts about a site, read as data, typed end to end**.

## The trap

1. **Executing the thing you are inspecting.** `include`-ing `version.php` or `wp-config.php` to read a variable runs whatever is in that file, with your privileges, on your machine. A compromised client site would compromise you.
2. **The stringly-typed inventory.** Arrays of arrays of strings, passed everywhere, checked nowhere. It works until a header has a trailing space or a version is `null`, and then every downstream module inherits the bug.
3. **Writing Java in PHP.** Interfaces for everything, factories for factories, a container for a CLI with six classes. Modern PHP is typed, not ceremonial.

## The feature

- A Composer package with PSR-4 autoloading, a `bin/steward` script and a `composer.lock` committed.
- Readonly value objects (or classes with asymmetric visibility) for `Site`, `Core`, `Plugin`, `Theme`, `MuPlugin`, `DropIn`, and a backed enum for component kind.
- A header parser that reads only the first few kilobytes of a file as text and extracts declared fields.
- A version reader for core that parses `version.php` as text and refuses anything it can't parse.
- `steward inventory <path> [--format=json|table]` with a documented exit-code contract.
- Pest or PHPUnit tests against at least four fixture sites, including one with broken headers.
- PHPStan at max, with no baseline, in a `composer check` script.

## Decision map

1. **Arrays vs value objects.** Associative arrays with PHPDoc shapes · readonly classes · classes with property hooks and asymmetric visibility.
   *Forcing:* what does PHPStan at max force you to write for each, and which will M81 be glad to consume?
2. **Header parsing strategy.** WordPress's own regex approach, re-implemented · a stricter parser of your own · token-based reading with `PhpToken`.
   *Forcing:* what does the parser do on a header with Windows line endings, a BOM, or a field written twice?
3. **Version semantics.** `version_compare()` · a semantic-versioning library · your own comparison with explicit rules.
   *Forcing:* WordPress versions like `7.0` and `7.0-RC1` are not semantic versions. What do you promise about ordering?
4. **Which source of truth wins.** Main-file header · readme `Stable tag` · both, reported with a disagreement flag.
5. **Error model.** Exceptions · warnings collected into the result · a result type with errors as values.
   *Forcing:* one broken plugin among forty — does the run still produce an inventory?
6. **Minimum PHP version for the tool.** 8.3 · 8.4 · 8.5.
   *Forcing:* which features would you lose, and on which machines must the tool run?

## Research targets

- **PHP's type juggling and `strict_types` — 25 min.**
  **Done when:** you can predict, for five calls, whether PHP coerces, throws a `TypeError`, or emits a deprecation.
- **Composer autoloading and the lock file — 25 min.**
  **Done when:** you can explain what `composer install` guarantees that `composer update` does not.
- **PHPStan levels and generics in PHPDoc — 45 min (deep).**
  **Done when:** you can type a function that returns a map of slugs to plugins and have max accept it without a suppression.
- **What PHP 8.4 and 8.5 changed — 25 min.**
  **Done when:** you can rewrite one nested call as a pipe and one mutable property as asymmetric visibility, and say whether either helps here.

## Out of scope

Booting WordPress, reading the database, WP-CLI integration, network calls, a plugin system for Steward itself, a framework (Symfony Console is allowed; anything larger is not). → parking lot.

## Measure ritual

Run the inventory against all three fleet sites and your broken fixture.

**Numbers:** files executed from inspected sites (must be **0** — prove it, don't assume it), PHPStan errors at max (must be **0**), byte-identical output on a second run (yes/no), and wall time for the largest site.

## Hint ladder

<details><summary>PHPStan at max won't accept my inventory arrays</summary>

**Orient:** max is telling you it can't know what's inside `array`.

**Approach:** either describe the shape precisely in PHPDoc (`array{slug: string, version: string|null}`) or stop using arrays for records. Ask which one you'd rather maintain when M81 adds three fields.

**Near-spoiler (after two attempts):** make each record a `final readonly class` with promoted constructor parameters, keep `list<Plugin>` for collections, and convert to arrays only at the very edge, in one `toArray()` per type that the JSON encoder calls.

</details>

<details><summary>My version comparison says 7.0-RC1 is newer than 7.0</summary>

**Orient:** you're comparing strings, or you're treating the suffix as a higher segment.

**Approach:** read the `version_compare()` documentation on special forms like `RC`, `beta` and `dev`. Write a table of eight versions in the order you believe, then test against it.

</details>

## The slow walk

1. Write the output schema first, as an example JSON document for `alpha`.
   **Check:** a friend can say from it alone what `alpha` runs.
2. Set up the Composer package, `strict_types` everywhere, and PHPStan at max on an empty `src/`.
3. Write the value objects and their tests.
4. Write the header parser against fixture strings, including the broken ones.
   **Check:** no fixture file is ever executed — add a fixture whose code would create a file if run, and assert the file never appears.
5. Write the core version reader as a text parser.
6. Walk a site directory and assemble the inventory.
7. Add the CLI, the exit codes and the `table` format.
8. Run the measure ritual and write the numbers into the README.

## Prove it — the three rooms

- **Interview:** explain why the tool parses `version.php` as text instead of including it, and what a compromised client site could do to you otherwise.
- **Design review:** a colleague says arrays are "more PHP-like" and wants to drop the value objects. Show them the PHPStan output and the bug it would have caught.
- **Meetup:** "I wrote PHP the way I write TypeScript — strict types, enums, a static analyser at max — and it felt like a different language from the PHP I learned."

**Reach-backs:** M22 WordPress from the inside · M25 walking a filesystem safely · M39 input as instructions.

---

<a id="m79"></a>
# M79 — A Plugin That Passes Review · REST, PHP-only blocks, WPCS & Plugin Check · (L)

> **Story.** As the person who maintains a client's site, I want a small plugin on every site that records what maintenance was done and shows the client a plain summary, so that my work is visible, auditable and impossible to lose — and so that the plugin itself never becomes the hole an attacker walks through.
>
> **MVP.** *Steward Log*: a plugin that stores maintenance events (update applied, backup verified, secret rotated, incident opened or closed), lists them on an admin screen for administrators, accepts new events through an authenticated REST endpoint that M81's tooling will call, and renders a "last maintained" summary block for the client — registered in PHP only, as WordPress 7.0 allows. It passes Plugin Check with zero errors, the WordPress Coding Standards, and PHPStan with WordPress stubs.
>
> **Acceptance criteria.**
> - Every REST route has a `permission_callback` that checks a capability; none returns `true` unconditionally.
> - Every database query that includes a variable goes through `$wpdb->prepare()` or a higher-level API.
> - Every output is escaped as late as possible, with the escaper that matches its context.
> - Plugin Check reports zero errors; PHPCS with the WordPress standard reports zero errors.
> - Deactivating changes nothing stored; uninstalling removes everything the plugin created, and nothing else.
> - All user-facing strings are translatable with one text domain.

## Ground Floor — How a plugin is judged

*Read this before the Briefing. It assumes M22, so you've written a plugin with a hook, a shortcode and a nonce, and M78's Composer and PHPStan setup, but not that you've registered a REST route, a block, or run the review tools WordPress.org uses. You'll register one REST route and one block on a fleet site and run the reviewers' tools against your own throwaway code first. This tells you what each piece is for and what to look up, never how to write it. Storage, authentication, the block, uninstall behaviour and the review fixes are the module's.*

### GF.1 — The picture first

```
                    ┌──────────── the plugin ────────────┐
admin screen  ─────▶│ capability check → nonce → handler │──▶ $wpdb->prepare / WP APIs
REST request  ─────▶│ route → permission_callback        │      │
                    │        → args: validate, sanitize  │      ▼
                    │        → callback                  │   database
front end     ◀─────│ block render: escape LATE          │
                    └────────────────────────────────────┘
lifecycle:   activate ─▶ (runs) ─▶ deactivate ─▶ uninstall.php
review:      PHPCS (WPCS) · Plugin Check · PHPStan + WP stubs · a human

Authentication says WHO. Capabilities say WHAT THEY MAY DO. A nonce says THEY MEANT IT.
None of the three replaces another.
```

### GF.2 — The REST API

**Look up:** `register_rest_route`; the `permission_callback`, `args`, `validate_callback` and `sanitize_callback` keys; `WP_REST_Request` and `WP_REST_Response`; how cookie authentication needs the `X-WP-Nonce` header; and application passwords (in core since 5.6).

**Do:** register one read-only route on a fleet site that returns the site name. Call it with `curl` without credentials, then with an application password.

### GF.3 — Blocks, the PHP way

**Look up:** `block.json`; `register_block_type`; dynamic blocks and `render_callback`; and WordPress 7.0's PHP-only block registration, which lets a server-rendered block exist without a JavaScript build.

**Question to settle:** what does a block you write in PHP only give up in the editor, compared with one built with `@wordpress/scripts`?

### GF.4 — Where plugin data lives

**Look up:** custom post types and post meta; the options API and the `autoload` flag; `dbDelta()` and custom tables; and how each one appears in an export, a backup and a migration.

**Do:** open the `wp_options` table on a fleet site and count the autoloaded rows. Find the three largest.

### GF.5 — The reviewers' tools

**Look up:** the WordPress Coding Standards for PHPCS (WPCS 3) and what they enforce beyond style (escaping, nonces, prepared SQL); the Plugin Check plugin; `php-stubs/wordpress-stubs` and the PHPStan WordPress extension; and the Detailed Plugin Guidelines on WordPress.org.

**Do:** run PHPCS with the WordPress standard and Plugin Check against your M22 plugin. Count the findings.

### GF.6 — Run it and observe

**Notice and leave alone:**

1. **Your read-only route.** Change its `permission_callback` to `__return_true` and call it without credentials. Now picture the same route *writing* data. That's M79's trap.
2. **The July 2026 *wp2shell* advisories describe a REST batch request that reached a handler without its authorization check running.** Read one advisory's summary — not the exploit. Where in your GF.1 picture did the check go missing? That's the trap again, from the other side.
3. **Your M22 plugin's PHPCS and Plugin Check findings.** Which ones are style, and which ones would have been vulnerabilities? That's the review half of the module.
4. **Your autoloaded options count.** Where should a log of hundreds of events live? That's M79's first decision.
5. **M81's tooling will call this plugin from a script, not a browser.** Cookie and nonce, application password, or something else? That's the second decision.
6. **Deactivate and delete your M22 plugin.** What did it leave behind in the database? That's the fifth decision.

### GF.7 — Hand-off: what's yours in M79

| Ground Floor left this… | M79 asks you to… |
|---|---|
| A read-only route with a permissive check | Routes whose permission callbacks check capabilities, with validated arguments |
| A count of autoloaded options | Decide where events live |
| `curl` with an application password | Decide how a script authenticates to the plugin |
| A PHP-only block, imagined | A server-rendered summary block for the client |
| PHPCS and Plugin Check findings on old code | Zero errors from both on new code |
| An M22 plugin that left rows behind | Decide deactivation and uninstall behaviour |
| One text domain, maybe | Every string translatable |

Then read the Briefing below, and fill in your Trust Ledger and Clock Sheet before building.

### GF.8 — Check yourself before moving on

- What do authentication, a capability check and a nonce each prove? Which one is missing if a logged-in subscriber can call an admin action?
- What does `permission_callback` receive, and what must it return?
- What's the difference between deactivation and uninstall, and which file runs on uninstall?
- Why is an autoloaded option a performance decision?
- Name one WPCS rule that exists for security rather than style.

## Briefing

M22 built one feature. This module builds a plugin to the standard a reviewer would hold it to — because on a client's site, your plugin *is* part of the attack surface, and in 2025 the overwhelming majority of new WordPress vulnerabilities — more than nine in ten — were in plugins, not core.

The most common shape of a plugin vulnerability is not exotic. It is a handler that does the right thing for the right user and *also* for the wrong one: an AJAX action registered for logged-out users, a REST route whose permission callback returns `true`, a capability check that tests "is logged in" instead of "may do this". In July 2026 even WordPress core shipped this shape: the *wp2shell* chain began with a REST batch request that reached a handler without its authorization running, and finished with a SQL injection. It was patched in 6.9.5 and 7.0.2 and mass-exploited within about two days. The lesson for a plugin author is blunt: **authorization belongs at the handler, every time, checked by a test.**

WordPress 7.0 ("Armstrong", May 2026) makes some of this easier: blocks can be registered entirely in PHP, the Abilities API gives plugins a declared, permission-checked way to expose actions, and the review tools have matured. WordPress.org now holds plugin updates for a day while an automated review looks for malware, and requires developers to use multi-factor authentication. None of that reviews *your* permission callbacks.

The center of gravity is **every entry point checked at the handler, every output escaped at the edge, and a plugin that leaves the site as it found it**.

## The trap

1. **`'permission_callback' => '__return_true'` on a route that changes something.** Or a check for `is_user_logged_in()` where a capability was needed. It works in every demo because the demo user is an administrator.
2. **A nonce as authorization.** A nonce proves the request came from a page the user loaded; it does not prove the user may perform the action. Leaked or reused nonces turn that confusion into privilege escalation.
3. **Escaping early, or not at all.** Sanitizing on input and then trusting the stored value on output. Stored data is input from the past.
4. **The plugin that never leaves.** Autoloaded options and tables that outlive the plugin, slowing every page load for years.

## The feature

- A plugin with a single prefix or namespace, a main file with complete headers (`Requires at least`, `Requires PHP`, `Text Domain`, `License`), and a Composer autoloader that is safe to ship.
- Event storage chosen in the decision map, with a schema version and a migration path.
- An admin screen listing events for users with a capability you name, with filtering by type.
- A REST namespace with: create event (machine authenticated), list events (administrators only), and a summary (public, but returning only what the client chose to publish).
- A PHP-only dynamic block rendering the summary, with escaping in the render callback.
- `uninstall.php` that removes exactly what the plugin created.
- PHPCS (WordPress standard), Plugin Check and PHPStan with WordPress stubs, all clean, all in one `composer check`.
- Tests for every permission callback: anonymous, subscriber, editor, administrator, and an application password.

## Decision map

1. **Where events live.** Custom post type with meta · custom table · options.
   *Forcing:* five hundred events after a year — which one is cheap to query by type and date, and which one bloats every page load?
2. **How a script authenticates.** Application passwords · a plugin-issued token · cookie plus nonce.
   *Forcing:* which one can you revoke per machine without logging a human out, and where is each secret stored? (M80 will rotate it.)
3. **Capabilities.** Reuse `manage_options` · define your own capability and grant it to roles.
   *Forcing:* could a client's office manager read the log without being able to install plugins?
4. **Block implementation.** PHP-only dynamic block · a JavaScript-built block · a shortcode.
   *Forcing:* who edits this site, and what do they lose without a live preview?
5. **Lifecycle.** What deactivation does · what uninstall does · whether uninstall asks first.
6. **Minimum versions.** `Requires at least` and `Requires PHP`.
   *Forcing:* WordPress 7.0 requires PHP 7.4 at minimum; your M78 tool says what your fleet runs. Which sites would this plugin refuse?

## Research targets

- **The REST API's permission model — 25 min.**
  **Done when:** you can say what happens when `permission_callback` is missing, returns `false`, returns a `WP_Error`, and returns `true`.
- **Escaping functions by context — 25 min.**
  **Done when:** you can name the escaper for HTML text, an attribute, a URL, inline JavaScript data and a translated string with markup.
- **The wp2shell advisories — 25 min.**
  **Done when:** you can describe, without exploit detail, which check was skipped, which versions were affected, and which versions fixed it.
- **Plugin Check and the Detailed Plugin Guidelines — 45 min (deep).**
  **Done when:** you can list five things that would get a plugin rejected that PHPCS would never notice.

## Out of scope

Multisite, a settings framework, a JavaScript build pipeline, Gutenberg editor UI beyond the block's server render, submitting to the WordPress.org directory, a premium licensing server. → parking lot.

## Measure ritual

Install the plugin on all three fleet sites.

**Numbers:** Plugin Check errors (must be **0**), PHPCS errors (must be **0**), REST permission tests passing (must be all), autoloaded bytes the plugin adds, and rows left in the database after uninstall (must be **0**).

## Hint ladder

<details><summary>My REST route works in the browser but returns 401 from curl</summary>

**Orient:** the browser is sending a cookie, and something else the cookie needs.

**Approach:** read how cookie authentication requires a nonce in the `X-WP-Nonce` header, and how application passwords use HTTP Basic authentication instead. Decide which one your script should use — then check that the route's permission callback asks for a capability, not just a logged-in user.

</details>

<details><summary>Plugin Check flags output I'm sure is safe</summary>

**Orient:** the tool can't see that it's safe; a reviewer can't either.

**Approach:** escape at the point of output even if you sanitized on input, and with the escaper for that exact context. If the value contains markup you mean to keep, use the function that allows a list of tags, and choose that list on purpose.

**Near-spoiler (after two attempts):** move every `echo` of a variable into the render function and wrap each one: `esc_html()` for text, `esc_attr()` for attributes, `esc_url()` for links, `wp_kses_post()` for trusted rich text — and for translated strings, `esc_html__()` instead of `__()`.

</details>

## The slow walk

1. Write the plugin's threat list: every entry point, who should reach it, and what it can change.
   **Check:** each entry point has one named capability.
2. Scaffold the plugin with headers, prefix, text domain and `composer check`; get all three tools clean on an empty plugin.
3. Build storage and its schema version.
4. Build the REST routes with permission tests *first*.
   **Check:** anonymous and subscriber requests fail before any handler code exists.
5. Build the admin screen.
6. Build the PHP-only summary block.
7. Write `uninstall.php` and prove it on a disposable copy.
8. Run the measure ritual; fix until every number meets its bar.

## Prove it — the three rooms

- **Interview:** explain the difference between authentication, a capability check and a nonce, using your three REST routes as the examples.
- **Design review:** a teammate's route uses `'permission_callback' => '__return_true'` "because the handler checks later". Use the wp2shell summary to explain why the check belongs in the permission callback, and show the test that would have caught it.
- **Meetup:** "My maintenance plugin passes the same checks WordPress.org reviewers run — and every route has a test that tries to call it as the wrong person."

**Reach-backs:** M22 sanitize, escape, nonce · M4 who is asking · M39 regression tests for every fix.

---

<a id="m80"></a>
# M80 — Secrets Have a Blast Radius · wp-config, environment, AI keys & rotation · (M)

> **Story.** As the person trusted with a client's credentials, I want to know every secret each site depends on, keep each one where the fewest things can read it, and be able to rotate any of them in minutes, so that a leak becomes a routine chore instead of a breach.
>
> **MVP.** A **Trust Ledger** for the three fleet sites, generated as far as possible by Steward; secrets moved out of `wp-config.php` and out of the web root; secret scanning on every repository you own, in a pre-commit hook and in CI, over the full history; a `steward exposure` check that looks for the common ways a site leaks its own secrets over HTTP — run only against your local fleet; and a timed rotation drill for four kinds of secret.
>
> **Acceptance criteria.**
> - No secret is stored in a file under the web root, and no secret is committed to any repository you own, including in history.
> - Each fleet site's Trust Ledger lists every credential with where it lives, who can read it, and how to rotate it.
> - The rotation drill has been run, timed and written down for: WordPress salts, the database password, an application password, and an AI provider key.
> - `steward exposure` finds every exposure you planted in a disposable copy of a fleet site and reports nothing on a clean one.
> - A planted fake secret in a new commit is blocked by the pre-commit hook and, separately, by CI.

## Ground Floor — Where secrets live, and how they leak

*Read this before the Briefing. It assumes M78's inventory tool and M79's plugin with an application password, and M39's secrets-in-code vocabulary, but not that you've traced every credential a WordPress site holds or rotated one on purpose. You'll open a fleet site's configuration, list its secrets by hand, and watch what rotation breaks first. This tells you what each piece is for and what to look up, never how to write it. Storage, scanning, the exposure checks and the rotation runbook are the module's.*

### GF.1 — The picture first

```
a WordPress site's secrets, and who can read them
──────────────────────────────────────────────────────────────────────────
wp-config.php      DB password · 8 keys & salts       ← every PHP file on the server
wp_options         SMTP password · API keys · AI keys  ← every plugin · every backup · every export
wp_usermeta        application passwords (hashed)     ← the database
.env / host panel  same, if moved there               ← the process · the host's staff
your laptop        SSH keys · deploy tokens · .env    ← every tool & agent you run
git history        anything EVER committed            ← everyone who ever clones it
backups, logs      copies of all of the above         ← wherever the backups go

leak  ─▶  someone else holds a working credential
rotate ─▶  the old one stops working        (deleting the leak does NOT do this)
```

### GF.2 — `wp-config.php`, line by line

**Look up:** every constant in a default `wp-config.php`; what the eight authentication keys and salts are used for; the WordPress secret-key service; `DISALLOW_FILE_EDIT` and `DISALLOW_FILE_MODS`; `WP_DEBUG_LOG` and where its file is written by default; and how hosts and setups like Bedrock read configuration from the environment.

**Do:** list every secret in one fleet site's `wp-config.php` on your Trust Ledger. Then search that site's `wp_options` for anything that looks like a key or password.

### GF.3 — Secrets in the database and in plugins

**Look up:** how plugins usually store API keys (options, often autoloaded and unencrypted); how WordPress stores application passwords; and how WordPress 7.0's AI Client expects provider credentials to be supplied.

**Question to settle:** if one plugin on a site has an arbitrary-file-read or SQL injection bug, which of your Ledger rows does an attacker now hold?

### GF.4 — How secrets leak

**Look up**, as patterns: editor backups and copies served as text (`wp-config.php.bak`, `.swp`, `~`); `.env` files served by the web server; an exposed `.git` directory; `phpinfo()` pages; `debug.log` inside `wp-content`; secrets echoed into the REST index or an error page; and secrets pasted into tickets, chats and AI prompts.

**Do:** in a disposable copy of `gamma`, plant three of these with *fake* values, then fetch each one from `localhost` with `curl`.

### GF.5 — Scanners

**Look up:** gitleaks or TruffleHog; scanning the working tree vs the full history; pre-commit hooks; and GitHub's push protection.

**Do:** run one scanner over the full history of every repository you own. Read every finding, even the false positives.

### GF.6 — Run it and observe

**Notice and leave alone:**

1. **Change one salt in `wp-config.php` on `beta`, then reload the admin.** What happened to your session? Who else would that happen to? That's M80's fourth decision.
2. **Your scanner's history findings.** If one of them were real, would deleting the line and committing again fix it? That's M80's trap.
3. **Your GF.3 question.** How many Ledger rows sat in the database, readable by every plugin? That's the first decision.
4. **Picture the AI key a client pasted into a 7.0 AI provider setting.** Who pays when it leaks, and how quickly would anyone notice? That's the second decision.
5. **Your GF.4 fetches.** Which of them would a scanner on the internet find within a day? That's the third decision.
6. **Your laptop.** Which tools and AI agents running there can read your fleet's `.env` files? That's the fifth decision.

### GF.7 — Hand-off: what's yours in M80

| Ground Floor left this… | M80 asks you to… |
|---|---|
| A hand-written Ledger for one site | A Ledger for every fleet site, generated where possible |
| Secrets found in `wp_options` | Decide where each class of secret lives |
| An AI key with no owner | Decide how AI provider keys are stored, scoped and capped |
| Three exposures fetched by hand | `steward exposure`, for your fleet only |
| One salt changed by accident | A rotation runbook, timed for four kinds of secret |
| A one-off history scan | Pre-commit and CI scanning that block a new leak |
| Agents on your laptop, imagined | Decide what your development machine may read |

Then read the Briefing below, and fill in your Trust Ledger and Clock Sheet before building.

### GF.8 — Check yourself before moving on

- What stops working when you change WordPress's salts, and why?
- Why doesn't deleting a committed secret from the repository fix the leak?
- Name four ways a WordPress site can serve one of its own secrets over HTTP.
- Where does WordPress write `debug.log` by default, and why does that matter?
- What's the difference between a secret's location and its blast radius?

## Briefing

A secret's danger is not where it is written but **who can read it and what it unlocks** — its blast radius. A database password in `wp-config.php` can be read by every PHP file on the server, which means by every plugin, which means by every plugin's vulnerabilities. An API key in `wp_options` is also in every backup, every staging copy and every migration export. A deploy token on your laptop is readable by every tool you run there — and in August 2025 the malicious *s1ngularity* releases of the Nx build tool showed what that means, by prompting AI coding command-line tools already installed on developers' machines to search for credentials.

The 2025 numbers are bad and getting worse. GitGuardian's 2026 report counted about 29 million new secrets in public GitHub commits during 2025, with leaked AI-service credentials up by about 81% — and commits co-authored by an AI coding assistant leaking secrets at roughly twice the rate of the baseline. It also found tens of thousands of secrets in MCP configuration files. On the PHP side, research published in July 2025 found more than 260,000 Laravel `APP_KEY` values exposed on GitHub; because Laravel's `decrypt()` unserializes what it decrypts, hundreds of live applications with a leaked key were open to remote code execution. In November 2025 a popular WordPress AI plugin's optional "No-Auth URL" setting exposed its MCP bearer token through the REST API, letting an anonymous visitor make themselves an administrator (CVE-2025-11749, fixed in 3.1.4). In May 2026, rewritten tags on the `laravel-lang` Composer packages delivered a credential stealer that ran through Composer's autoloader on every request.

None of this is fixed by hiding a secret better. It is fixed by **knowing every secret, shrinking what can read it, and being able to rotate it fast** — because a secret that has leaked stays leaked until it stops working.

The center of gravity is **inventory, least readership, and rotation you have actually timed**.

## The trap

1. **Deleting instead of rotating.** Removing a leaked key from the repository, the ticket or the file leaves every copy that was already made working. Only rotation ends a leak.
2. **Moving the secret without shrinking its readers.** From `wp-config.php` to an autoloaded option, from a file to an environment variable every plugin can read — a new address, the same blast radius.
3. **The unrotatable secret.** A key you've never rotated is a key you can't rotate under pressure: you'll find out what depends on it during the incident.

## The feature

- A Trust Ledger per fleet site, with M78's inventory filling in which plugins and drop-ins are present and therefore which secrets probably exist.
- Configuration that reads secrets from the environment or from files outside the web root, with `DISALLOW_FILE_EDIT` set and debug logging written outside `wp-content`.
- A decision, written down and applied, for where AI provider keys live and how their spending is capped.
- `steward exposure <fleet-site>`: HTTP checks against `localhost` only, for configuration backups, `.env`, `.git`, `phpinfo`, `debug.log`, and secrets visible in the REST index. It refuses any host not in your fleet file.
- Secret scanning in a pre-commit hook and in CI, over full history, with a documented way to handle a false positive.
- A rotation runbook with measured times for salts, the database password, an application password and an AI provider key.

## Decision map

1. **Where each class of secret lives.** `wp-config.php` constants · environment variables · files outside the web root · the host's secret store · the database.
   *Forcing:* for each one, list every reader. Which list is shortest that still works on this client's hosting?
2. **AI provider keys.** One key per site · one key per client · your agency key with per-site limits · the client's own account.
   *Forcing:* who receives the bill, who notices abuse first, and who can revoke it at 2 a.m.?
3. **What `steward exposure` checks.** A fixed list · a list driven by the inventory · both.
   *Forcing:* how do you stop this tool from ever being pointed at someone else's site?
4. **Salt rotation policy.** Never · on schedule · on every incident · on staff change.
   *Forcing:* it logs everyone out. Who must be warned?
5. **Your development machine.** What your shell, editor, AI agents and package managers can read; whether fleet secrets exist there at all.
6. **Scanner false positives.** Inline allow · a central allow-list · rewrite the fixture.

## Research targets

- **WordPress keys and salts — 25 min.**
  **Done when:** you can say which cookies and nonces each one affects, and what rotation invalidates.
- **Secret-scanner coverage — 25 min.**
  **Done when:** you can explain what your scanner checks in history that a working-tree scan misses, and one kind of secret it can't recognise.
- **The Laravel `APP_KEY` research (2025) — 25 min.**
  **Done when:** you can explain, without exploit detail, why a leaked encryption key became remote code execution, and why rotation was the remedy.
- **Secrets and AI tooling — 45 min (deep).**
  **Done when:** you can name three ways an AI coding tool or an MCP configuration can expose a credential, and one control for each.

## Out of scope

A full secrets manager deployment, hardware security modules, encrypting the WordPress database, network scanning, scanning anything outside your fleet. → parking lot.

## Measure ritual

Run the drill on `alpha`, `beta` and `gamma`.

**Numbers:** secrets per site on the Ledger, secrets readable by every plugin before and after, minutes to rotate each of the four kinds (median of two runs), planted exposures found (must be **all**), and false exposures on a clean site (must be **0**).

## Hint ladder

<details><summary>After moving the database password into the environment, the site works in the browser but WP-CLI can't connect</summary>

**Orient:** two different processes are reading configuration, and only one of them sees the environment.

**Approach:** list how PHP-FPM gets its environment and how your shell does. Decide one source that both read — a file outside the web root, loaded by `wp-config.php`, is a common answer — and write that into the runbook.

</details>

<details><summary>My scanner blocks a commit for a test fixture</summary>

**Orient:** the fixture looks exactly like a real secret, which is the point of the scanner.

**Approach:** make fixtures look fake on purpose (a `FAKE_` prefix, an impossible length) or allow-list one path with a comment that says why. Never allow-list a pattern.

**Near-spoiler (after two attempts):** generate fixture secrets at test time instead of committing them, and keep one central allow-list file that a reviewer must approve — so a new exception is visible in a pull request rather than hidden in a line comment.

</details>

## The slow walk

1. Write the Ledger for `alpha` by hand, row by row.
   **Check:** every row has a reader list and a rotation step.
2. Extend M78 so the inventory suggests Ledger rows for the plugins it finds.
3. Move secrets out of `wp-config.php` and the web root on all three sites; set `DISALLOW_FILE_EDIT`; move the debug log.
4. Install scanning in a pre-commit hook and in CI; scan full history.
   **Check:** a planted `FAKE_` key in a new commit is blocked twice.
5. Build `steward exposure` with its fleet-only guard *first*.
   **Check:** it refuses `example.com`.
6. Plant exposures in a disposable copy of `gamma`; make the tool find all of them.
7. Run the rotation drill twice; time each step; write the runbook.

## Prove it — the three rooms

- **Interview:** explain blast radius using one secret from `wp-config.php` and one from `wp_options`, and why rotation, not deletion, ends a leak.
- **Design review:** a client wants their AI features "just working" with your agency's key pasted into every site. Lay out who pays, who notices, and who can revoke — and propose the alternative.
- **Meetup:** "I can rotate every secret on a client's WordPress site in under N minutes, and I know because I timed it."

**Reach-backs:** M39 secrets in git history · M41 the watchdog script · M4 tokens and what they unlock.

---

<a id="m81"></a>
# M81 — Patch Day at Machine Speed · update pipeline, supply chain & incident drill · (L)

> **Story.** As the person a client calls when their site is hacked, I want to learn about a dangerous vulnerability on any of my sites within hours, patch it safely before it is exploited, notice when an update itself is the attack, and know exactly what to do if I lose the race, so that "we were hacked" becomes rare, short, and honest.
>
> **MVP.** `steward patch`: match M78's inventory for every fleet site against a vulnerability feed, rank what matters, apply updates to a staging copy first, run smoke checks, promote to the "production" copy, and record every step through M79's Steward Log. One fleet site is managed with Composer and a lock file. And an **incident drill**: you plant inert indicators of compromise in a disposable copy of a fleet site, then detect, contain and recover it with a written runbook.
>
> **Acceptance criteria.**
> - Within one run, every component on every fleet site with a known vulnerability in the feed is listed with its severity and fixed version.
> - No update reaches a production copy without passing smoke checks on its staging copy first; a failed check stops promotion and says why.
> - PHP versions are part of the inventory and the report: a site on a PHP branch without security support is flagged even if WordPress is current.
> - The incident drill detects every planted indicator, and the site is restored from backup to a verified clean state.
> - Every update, skip, rollback and incident step appears in the Steward Log.

## Ground Floor — The clock, the feed and the update

*Read this before the Briefing. It assumes M78's inventory, M79's Steward Log, M80's Trust Ledger, and WP-CLI from M22's Ground Floor, but not that you've consumed a vulnerability feed, run a staged update, or investigated a compromised site. You'll look up one real advisory against your fleet, run one update by hand on a copy, and verify checksums first. This tells you what each piece is for and what to look up, never how to write it. Policy, ranking, smoke checks, rollback and the runbook are the module's.*

### GF.1 — The picture first

```
disclosure ─▶ patch released ─▶ exploit written ─▶ mass scanning ─▶ your site
     │              │                 │                 │
     │              └──── hours ──────┴──── hours ──────┘      (2025–26 reality)
     ▼
feed (Wordfence / Patchstack / WPScan) ─▶ steward: inventory × feed ─▶ ranked list
                                                                          │
                     staging copy ◀─ update ◀─────────────────────────────┘
                          │
                     smoke checks ──fail──▶ stop, log, tell a human
                          │pass
                     production ─▶ log ─▶ client summary

and the other direction:
vendor account / build pipeline / git tag  ─▶  a POISONED update  ─▶  your site
```

### GF.2 — Vulnerability feeds

**Look up:** the Wordfence Intelligence vulnerability data feed, the Patchstack database and the WPScan API; what each record contains (software slug, affected range, fixed version, CVSS, CVE); and their terms of use.

**Do:** pick one plugin on `alpha` and find every advisory for it in one feed. Compare the affected ranges with the version M78 reports.

### GF.3 — WP-CLI for maintenance

**Look up:** `wp plugin update --dry-run`; `wp core verify-checksums`; `wp plugin verify-checksums --all`; `wp user list --role=administrator`; `wp db export`; and how to point WP-CLI at a specific site path.

**Do:** run both checksum commands on a clean fleet site. Then add one blank line to a core file in a disposable copy and run them again.

### GF.4 — Composer-managed WordPress

**Look up:** wpackagist, Roots Bedrock, `composer.lock`, `composer audit`, and how recent Composer versions treat packages with known security advisories during an update.

**Question to settle:** on a Composer-managed site, what does an attacker have to change for you to install a poisoned plugin version — and what would `composer.lock` show you?

### GF.5 — Recent incidents, as cases

**Look up**, as summaries only — no exploit code: the July 2026 *wp2shell* chain in WordPress core (affected and fixed versions; how quickly mass exploitation followed); the October 2026 *PHP2Shell* bugs in PHP itself (affected versions, fixed versions, and which old branches received no fix); and one 2026 plugin supply-chain incident (a closed plugin family, a compromised premium build pipeline, or a backdoored update).

**Do:** for each case, write one line on your Clock Sheet: time from patch to mass exploitation, and what *your* first action would have been.

### GF.6 — Run it and observe

**Notice and leave alone:**

1. **Your PHP2Shell case.** Updating WordPress wouldn't have fixed it. Who updates PHP on each fleet site — you, the host, or nobody? That's M81's fourth decision.
2. **Your supply-chain case.** The fastest updater installed the backdoor first. What would a delay have bought, and what would it have cost during wp2shell? That's M81's trap.
3. **Your GF.2 advisories.** One feed, one plugin — did the version ranges match your inventory exactly? That's the first decision.
4. **The checksum run after your one-line edit.** What did it catch, and what would it never catch? (Hint: `wp-content`.) That's the sixth decision.
5. **A site that returns `200 OK` with a blank page.** Did the update succeed? That's the third decision.
6. **The update that broke the site.** Do you go back by restoring a backup or by installing the previous version? That's the fifth decision.

### GF.7 — Hand-off: what's yours in M81

| Ground Floor left this… | M81 asks you to… |
|---|---|
| One plugin matched against one feed by hand | Every component on every site matched and ranked |
| Two Clock Sheet lines | An update policy per component class, with a written delay rule |
| `200 OK` with a blank page | Smoke checks that know what "working" means for each site |
| Checksums on a clean site | A detection baseline, including what checksums can't see |
| A lock file, read | One Composer-managed fleet site, audited |
| PHP updates with no owner | PHP versions in the report, with an owner for each site |
| A rollback, imagined | Decide rollback by restore or by version, and drill it |

Then read the Briefing below, and fill in your Trust Ledger and Clock Sheet before building.

### GF.8 — Check yourself before moving on

- What did wp2shell require from an attacker, which versions were affected, and which fixed it?
- Why would a fully updated WordPress site still have been exposed to PHP2Shell?
- What does `wp core verify-checksums` prove, and what can't it see?
- Name two ways a malicious update reached sites in 2026 without the attacker exploiting a vulnerability on the site itself.
- What does `composer.lock` protect you from, and what doesn't it?

## Briefing

Patching used to be a weekly chore. It is now a race with a clock you don't control. Patchstack's 2026 report found more than 11,000 new WordPress ecosystem vulnerabilities in 2025, up about 42% on the year before, with a median of around five hours from disclosure to mass exploitation for the most heavily targeted ones. Discovery has been industrialised: in May 2026 researchers described an AI pipeline that surfaced more than 300 critical plugin vulnerabilities in about three days, at roughly $20 each. In July 2026 the *wp2shell* chain — an authorization bypass in the REST batch endpoint plus a SQL injection, found with an AI model's help — gave unauthenticated attackers code execution on WordPress 6.9.0–6.9.4 and 7.0.0–7.0.1, and mass exploitation followed the 6.9.5 and 7.0.2 fixes within about two days.

The stack under WordPress is in the race too. On 21 October 2026, PHP released 8.5.12, 8.4.27, 8.3.36 and 8.2.35 to fix *PHP2Shell* — two remote-code-execution bugs reachable without authentication, present from PHP 5.4 onward, and found with AI assistance by several teams. The 7.4, 8.0 and 8.1 branches, which many WordPress sites still run, received no official fix. A site with every plugin current was still exposed if nobody owned its PHP version.

And speed alone is not safety, because **updates themselves became an attack path**. In April 2026 WordPress.org closed an entire family of 31 plugins in one day after a dormant backdoor activated in their updates. In June a premium plugin vendor's build and distribution pipeline turned out to have been compromised and was delivering malicious code inside its own update packages. In July a plugin with about 20,000 installations shipped a backdoor that let an attacker log in as one of the site's administrators, after an apparent developer-account compromise. In May, rewritten Git tags turned trusted Composer packages into a credential stealer. WordPress.org now holds plugin updates for about a day while an automated review scans them — a day of exposure traded for a chance to catch a poisoned update.

So the job is a **policy**, not a reflex: know what you run, learn about threats to it within hours, update in an order and at a speed chosen for each kind of component, verify before you promote, notice when an update looks wrong, and have a rehearsed answer for the day you lose.

The center of gravity is **the attacker's clock against yours, and an update channel you trust but verify**.

## The trap

1. **One speed for everything.** "Auto-update everything immediately" installed the 2026 backdoors first. "Nothing updates until I look at it" left sites open through wp2shell's weekend. Both are one rule standing in for a policy.
2. **"It returned 200."** A white screen, a broken checkout, or a missing menu all return `200 OK`. An update you didn't check is an update you hope worked.
3. **Patching only the application.** WordPress current, plugins current, PHP 8.1 — and nobody's name next to the PHP version.
4. **Restoring without finding the way in.** Restoring a clean backup over a site whose entry point you never closed is a scheduled reinfection.

## The feature

- `steward patch report`: inventory × feed for the whole fleet, ranked by severity, exploitation status and exposure, including PHP branch support status. Feed data is cached with its retrieval time shown.
- An update policy file per site: which components auto-update, which wait for a delay window, which need a human, and what overrides the delay (known exploitation, critical severity).
- `steward patch apply <site>`: clone to staging, update, run smoke checks, promote or stop, log each step to Steward Log.
- Smoke checks per site: key pages render with expected content, admin login works, one form submits, the PHP error log gained nothing new, checksums still verify.
- One fleet site converted to Composer management, with `composer audit` in the report.
- A detection baseline per site: administrator list, `mu-plugins` contents, drop-ins, core and plugin checksums, and a file-change list for `wp-content`.
- An incident runbook, rehearsed once: detect, contain, preserve evidence, find the entry point, restore, rotate (M80), tell the client (M82).

## Decision map

1. **Feed and matching.** Which feed · how often · how affected ranges are compared with M78's versions.
   *Forcing:* the feed says "all versions up to and including 3.1.3" and the site says `3.1.3.1`. What does your tool conclude?
2. **Update policy by component class.** Core minor · core major · free plugins from WordPress.org · premium plugins from vendor servers · themes · PHP.
   *Forcing:* write the delay for each, and the condition that overrides it. Use your wp2shell and supply-chain Clock Sheet lines as the two tests.
3. **What "working" means.** HTTP status · expected text on key pages · admin login · a form submission · error-log growth.
4. **Who owns PHP.** You · the host · the client's IT — per site, written down.
   *Forcing:* PHP2Shell left 7.4–8.1 without an official fix. What do you tell a client whose host can't upgrade?
5. **Rollback.** Restore the pre-update backup · reinstall the previous version · both, chosen per failure.
6. **Detection baseline.** What you record, where it lives so an intruder can't edit it, and how often you compare.
   *Forcing:* core checksums can't see a new file in `mu-plugins`. What can?

## Research targets

- **Vulnerability feed formats — 25 min.**
  **Done when:** you can map one feed record's fields onto your inventory's fields, including how affected ranges are written.
- **The wp2shell and PHP2Shell advisories — 25 min.**
  **Done when:** you can give affected and fixed versions for both, and which one a WordPress update alone would not have fixed.
- **2026 plugin supply-chain incidents — 45 min (deep).**
  **Done when:** you can describe three distinct ways a malicious update reached sites, and one control from your policy that would have slowed each.
- **Incident response for a small site — 25 min.**
  **Done when:** you can order these and say why: rotate, restore, preserve evidence, find the entry point, notify.

## Out of scope

A web application firewall you build yourself, malware reverse engineering, running exploits, hosting-level forensics, writing your own vulnerability database, monitoring sites outside your fleet. → parking lot.

## Measure ritual

Seed `gamma` with one plugin version that has a known advisory, and plant your inert indicators in a disposable copy of `beta`: a new administrator, a marker file in `mu-plugins`, a one-line change to a core file, and a marker file in `wp-content/uploads` with a `.php` extension.

**Numbers:** minutes from running the report to a patched, verified production copy of `gamma`; planted indicators detected (must be **all 4**); minutes from detection to a verified clean restore of `beta`; and updates promoted without passing smoke checks (must be **0**).

## Hint ladder

<details><summary>My report flags plugins that are already patched</summary>

**Orient:** the version comparison and the feed's range notation disagree.

**Approach:** print the raw range from the feed next to M78's version for each false positive. Look for "up to and including" versus "below", missing upper bounds, and versions with four segments or suffixes.

</details>

<details><summary>Smoke checks pass but the client says the site is broken</summary>

**Orient:** your checks test what's easy to test, not what the client uses.

**Approach:** ask the client — or the site's analytics — which three things make them money or trouble. Make one check per thing, asserting content, not status.

</details>

<details><summary>The drill restore succeeded, but the marker came back</summary>

**Orient:** you restored the site and left the way back in.

**Approach:** list every place the planted indicators lived, and every credential that could have planted them. Which of those did the restore replace, and which did it leave alone?

**Near-spoiler (after two attempts):** a restore replaces files and the database; it doesn't rotate the credentials an intruder used, close the vulnerable plugin, or remove an administrator account created after your backup was taken. Restore from a backup taken *before* the earliest indicator, update the entry point, then run M80's rotation for every row on the Ledger.

</details>

## The slow walk

1. Write the update policy for one site in plain language.
   **Check:** your wp2shell and supply-chain cases each get the right outcome under it.
2. Build `steward patch report` against cached feed data; include PHP branch support.
3. Build staging clones and smoke checks for one site.
   **Check:** a deliberately broken update is stopped before promotion.
4. Build promotion and Steward Log entries.
5. Convert `beta` or `gamma` to Composer management and add `composer audit` to the report.
6. Record detection baselines for all three sites.
7. Plant the inert indicators in a disposable copy; run the incident drill against your runbook.
   **Check:** every indicator found, restore verified, Ledger rotated.
8. Run the measure ritual and write the numbers into the Clock Sheet.

## Prove it — the three rooms

- **Interview:** walk through what you did — and in what order — the morning wp2shell's patch was published, and why PHP2Shell needed a different owner.
- **Design review:** a client insists on "auto-update everything, always". Use one 2026 supply-chain incident to explain the risk, and present your per-class policy as the alternative.
- **Meetup:** "I can tell you within an hour which of my clients' sites are exposed to a new WordPress or PHP vulnerability — and I've rehearsed the day I'm too late."

**Reach-backs:** M10 migrations that fight back · M39 regression tests for fixes · M41 the watchdog · M55 the client site.

---

<a id="m82"></a>
# M82 — The Practice · scoping, care plans, handover, CRA & team conventions · (M)

> **Story.** As a freelancer becoming a small agency's tech lead, I want the paperwork, prices and conventions that make M78–M81 sustainable — what I promise, what it costs, who owns what, how my team writes and reviews code, and what the law now expects — so that doing the work properly is also how the business survives.
>
> **MVP.** A **practice kit** in a repository: a statement-of-work template with ownership and access clauses; care-plan tiers priced from the minutes you measured in M80 and M81; a site handover pack; a team conventions template (coding standards, static analysis, CI with Plugin Check, a pull-request template with an AI-assistance disclosure and a security checklist); a vulnerability disclosure policy and `security.txt` for your plugin; a one-page note on whether the EU Cyber Resilience Act applies to you; and an accessibility checklist for client sites.
>
> **Acceptance criteria.**
> - Every care-plan price traces to a measured time from M80 or M81, plus a stated margin and a stated risk allowance.
> - The statement of work names who owns the domain, hosting, premium licences, backups and every administrator account — and none of them is "the freelancer" by default.
> - A new teammate can clone the conventions template and get PHPCS, PHPStan and Plugin Check running in CI without asking anyone.
> - The disclosure policy says where reports go, how fast you answer, and what happens if a vulnerability in your code is being actively exploited.
> - The CRA note reaches a written conclusion for your situation and lists the facts that would change it.

## Ground Floor — The business around the code

*Read this before the Briefing. It assumes M78–M81 are done, so you hold measured times for inventory, rotation and patching, and M55's client-site work, but not that you've priced recurring work, written a contract clause, or set conventions for other developers. You'll take the numbers you already have and look at them as a business first. This tells you what each piece is for and what to look up, never how to write it. Prices, clauses, conventions and the CRA conclusion are the module's — and none of this is legal advice; when money or liability is serious, a lawyer reads your contract.*

### GF.1 — The picture first

```
what the client buys              what it costs you                  what protects both of you
───────────────────────           ───────────────────────            ──────────────────────────
a launched site          ──▶      build hours                ──▶     statement of work
a site that stays safe   ──▶      M80 + M81 minutes × sites  ──▶     care plan with response times
a site they can leave    ──▶      handover hours             ──▶     ownership clauses + handover pack
your team's code         ──▶      review + CI time           ──▶     conventions + PR template
your plugin's users      ──▶      disclosure + fix time      ──▶     security.txt + CRA obligations
```

### GF.2 — Pricing recurring work

**Look up:** hourly, fixed-price and value-based pricing; WordPress "care plans" or maintenance retainers as offered by agencies; what a response-time promise is; and how a risk allowance differs from margin.

**Do:** from your M80 and M81 Clock Sheets, compute the minutes one site costs you per month in a quiet month and in a month like July 2026.

### GF.3 — Ownership and access

**Look up:** why agencies recommend clients own their domain registrar and hosting accounts; delegated access (hosting team members, registrar contacts); licence transfer for premium plugins; and the GPL as it applies to WordPress themes and plugins.

**Question to settle:** if you disappeared tomorrow, which of your clients could keep their site running without you? Which couldn't, and why?

### GF.4 — Conventions for a team

**Look up:** the WordPress Coding Standards versus PSR-12 and PER Coding Style, and where each is expected; `.phpcs.xml.dist`; PHPStan configuration with WordPress stubs; running Plugin Check in CI; and WordPress's February 2026 guidelines on AI-assisted contributions to core.

**Do:** write down the three conventions you'd fight for and the three you'd let a teammate choose.

### GF.5 — The law, briefly

**Look up**, as orientation, not legal advice: the EU Cyber Resilience Act's reporting obligations that apply from 11 September 2026 and its main obligations from 11 December 2027; how it treats free and open-source software that is not monetised, open-source stewards, and software sold commercially; the European Accessibility Act, in force since 28 June 2025; WCAG 2.2 level AA; and `security.txt` (RFC 9116).

**Question to settle:** if you sell a premium version of your Steward Log plugin to one EU customer, which of those apply to you?

### GF.6 — Run it and observe

**Notice and leave alone:**

1. **Your GF.2 quiet-month and July-2026-month numbers.** Which one would you price from? That's M82's trap.
2. **Your GF.3 "if you disappeared" list.** That's M82's second decision.
3. **Your GF.4 fight-for list.** How many of the three can a machine enforce? That's the fourth decision.
4. **Your GF.5 question.** What changed when the plugin went from free to sold? That's the fifth decision.
5. **A teammate opens a pull request with a plugin generated mostly by an AI assistant.** What would you need to see before approving it? That's the sixth decision.

### GF.7 — Hand-off: what's yours in M82

| Ground Floor left this… | M82 asks you to… |
|---|---|
| Two monthly-minute numbers | Care-plan tiers priced from measurement, margin and risk |
| A list of clients who couldn't leave you | Ownership and access clauses, and a handover pack |
| Three conventions worth fighting for | A conventions template enforced in CI |
| A question about AI-assisted code | A review policy for AI-assisted work |
| A question about selling the plugin | A written CRA conclusion, and the facts that would change it |
| `security.txt`, looked up | A disclosure policy with response times you can keep |

Then read the Briefing below, and fill in your Trust Ledger and Clock Sheet before building.

### GF.8 — Check yourself before moving on

- What's the difference between margin and a risk allowance in a care-plan price?
- Why should the client, not the freelancer, own the hosting and registrar accounts?
- Name two conventions WPCS enforces that PSR-12 doesn't.
- From when do the CRA's reporting obligations apply, and to whom?
- What does `security.txt` contain, and where does it live?

## Briefing

Most WordPress work is sold as a project and lived as a subscription. The site launches once and then needs patching, rotating, backing up and explaining for years — and in 2026 the patching part stopped being optional or slow. A freelancer who prices maintenance from a quiet month goes broke the first month like July 2026; one who doesn't sell maintenance at all leaves the client exposed and the relationship to whoever cleans up the hack.

The business sits on the engineering. M80 and M81 gave you measured minutes: that is the honest basis for a price. Ownership clauses are security controls — a client who owns their registrar and hosting can't be held hostage by you or by your successor, and you can't be blamed for an account you were never supposed to hold. A handover pack is what makes "you can leave" true.

The industry around you is also shifting. WordPress still runs about four in ten websites, but its share has drifted down from its 2025 peak, and the WP Engine–Automattic dispute — headed for a jury trial in 2027 — has pushed hosts and plugin vendors toward independence, from the Secure Custom Fields fork of ACF to the Linux Foundation's FAIR package manager. WordPress 7.0 put an AI Client and an Abilities API in core; plugin submissions to WordPress.org have roughly tripled since 2024, partly through AI-assisted development, and WordPress's own contribution guidelines now ask contributors to disclose AI assistance and take responsibility for it. As a tech lead, you will be reviewing more generated code than any previous generation of reviewers, against a faster clock.

And the law has arrived. Since 11 September 2026 the EU Cyber Resilience Act requires manufacturers of products with digital elements — which can include a plugin you *sell* — to report actively exploited vulnerabilities and severe incidents to the authorities on short deadlines, with its main obligations following on 11 December 2027. Free, non-monetised open-source work is largely outside those duties. The European Accessibility Act has applied since June 2025 to many consumer-facing services in the EU. You don't need to be a lawyer, but you do need to know which side of each line you stand on, and to write it down.

The center of gravity is **promises you can price, keep and hand over**.

## The trap

1. **Pricing from the quiet month.** Maintenance priced at average effort fails in the month that matters. Price from the bad month, with a written ceiling on what the plan covers.
2. **Holding the keys.** Domains, hosting and licences in the freelancer's account feel like convenience and work like a hostage situation — for the client if you vanish, and for you if something goes wrong under your name.
3. **Conventions nobody enforces.** A style guide in a wiki is a wish. A rule that CI fails on is a convention.
4. **"The AI wrote it" as a review category.** Generated code gets the same review as any other code, by someone who can explain every line — or it doesn't ship.

## The feature

- A statement-of-work template: scope, exclusions, ownership of every account and asset, access arrangements, change requests, and what ends the engagement.
- Care-plan tiers: what's included, response times by severity, a ceiling on included hours, and prices with their arithmetic shown.
- A handover pack template: Trust Ledger (with secrets *referenced*, never included), inventory, update policy, backup locations, runbooks, and a "first week without us" checklist.
- A conventions repository template: `.phpcs.xml.dist`, `phpstan.neon`, a CI workflow running PHPCS, PHPStan and Plugin Check against a disposable WordPress, a pull-request template with an AI-assistance disclosure and a security checklist drawn from M79.
- A vulnerability disclosure policy and `security.txt` for Steward Log.
- A one-page CRA applicability note and an accessibility checklist against WCAG 2.2 AA.

## Decision map

1. **Pricing model.** Hourly · fixed monthly tiers · value-based.
   *Forcing:* in a month like July 2026, who absorbs the extra hours under each model?
2. **Who owns what.** Client owns everything, you're delegated access · you own hosting, client owns the domain · you resell everything.
   *Forcing:* what happens on the day the relationship ends, under each?
3. **Response-time promises.** Business hours · next business day · around the clock for critical.
   *Forcing:* PHP2Shell's fixes landed on a Wednesday; wp2shell was being mass-exploited by Sunday, 19 July. What can one person actually promise?
4. **Machine-enforced conventions.** Which standards, which PHPStan level, which checks fail CI.
5. **Selling the plugin.** Free on WordPress.org · freemium · sold only to your clients.
   *Forcing:* how does each choice change your CRA position and your support load?
6. **AI-assisted code policy.** Disclosure required · reviewer must be able to explain every line · generated tests don't count as review · client data never in prompts.

## Research targets

- **WordPress care plans in the market — 25 min.**
  **Done when:** you can describe three real tiers from three agencies and say what each excludes.
- **Ownership and offboarding — 25 min.**
  **Done when:** you can list every account a typical client site depends on and who should own each.
- **The EU Cyber Resilience Act for small software vendors — 45 min (deep).**
  **Done when:** you can say what triggers reporting, the deadlines, and why selling changes your position — citing the Regulation or official guidance, not a vendor blog.
- **Coding standards in WordPress teams — 25 min.**
  **Done when:** you can explain when a team would use WPCS, when PSR-12 or PER, and how one repository can use both.

## Out of scope

Incorporating a business, tax, insurance products, hiring, marketing and sales funnels, writing your own contract law. If the numbers get serious, an accountant and a lawyer are part of the practice. → parking lot.

## Measure ritual

Price the three fleet sites as if they were clients, and onboard a "teammate" — a friend, or yourself on a clean machine — using only the conventions template.

**Numbers:** monthly price per site and the share of it that is measured time; months in your Clock Sheet where the plan's ceiling would be exceeded; minutes for the teammate to get CI green without asking for help; and accounts in the handover pack that the "client" owns (must be **all**).

## Hint ladder

<details><summary>My care-plan prices look too high to sell</summary>

**Orient:** the price is probably right; the plan is probably too big.

**Approach:** split what every site needs (inventory, patching, backups, rotation drills) from what some clients want (content edits, reports, performance work). Price the first as the floor, sell the second as tiers, and show the client the July 2026 timeline as the reason the floor exists.

</details>

<details><summary>The CI workflow passes locally and fails in GitHub Actions</summary>

**Orient:** CI is running a different PHP, a different WordPress, or a different set of tools.

**Approach:** pin all three in the workflow, print their versions as the first step, and make the local script read the same versions from one file.

**Near-spoiler (after two attempts):** use a version matrix that names exact PHP and WordPress versions, start WordPress for Plugin Check with `wp-env` or a container at a pinned tag, install tools from `composer.lock` rather than globally, and cache Composer by the lock file's hash.

</details>

## The slow walk

1. Write the statement-of-work ownership clauses first.
   **Check:** your GF.3 "couldn't leave" list is empty under them.
2. Build care-plan tiers from Clock Sheet minutes; show the arithmetic.
3. Write the handover pack template and fill it in for `alpha`.
4. Build the conventions template and its CI workflow.
   **Check:** a deliberately unescaped `echo` fails CI.
5. Write the pull-request template, including the AI-assistance disclosure and the security checklist.
6. Write `security.txt`, the disclosure policy and the CRA note.
7. Run the accessibility checklist on one fleet site and record the failures.
8. Onboard your "teammate" and run the measure ritual.

## Prove it — the three rooms

- **Client meeting:** a client asks why maintenance costs more this year. Use your Clock Sheet, wp2shell and PHP2Shell to explain it in five minutes without frightening them.
- **Design review (tech lead):** a junior developer wants to merge a plugin an AI assistant generated in an afternoon. Walk the PR template with them and decide together what must change before it ships.
- **Interview:** "Tell me about a time process protected a client." Answer with the ownership clauses, the patch policy and the drill.

**Reach-backs:** M55 shipping the client site · M22 the update-safe customization · M39 security as a habit.

---

<a id="source-shelf-volume-vii"></a>
# Source shelf for Volume VII

These are **seed sources**, not answer keys. Read only enough to close the module's done-when. Links current as of November 2026. Incident summaries are for orientation: read the vendor or project advisory before acting on any version number.

## Modern PHP

- PHP release history and supported versions: https://www.php.net/supported-versions.php
- PHP 8.4 release notes: https://www.php.net/releases/8.4/en.php
- PHP 8.5 release notes: https://www.php.net/releases/8.5/en.php
- PHP 8.6 preparation and RFCs: https://wiki.php.net/rfc
- Composer documentation: https://getcomposer.org/doc/
- PSR-4 autoloading: https://www.php-fig.org/psr/psr-4/ · PER Coding Style: https://www.php-fig.org/per/coding-style/
- PHPStan: https://phpstan.org/user-guide/getting-started

## WordPress development

- Plugin Handbook: https://developer.wordpress.org/plugins/
- REST API Handbook: https://developer.wordpress.org/rest-api/
- Block Editor Handbook: https://developer.wordpress.org/block-editor/
- Detailed Plugin Guidelines: https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
- WordPress Coding Standards for PHP_CodeSniffer: https://github.com/WordPress/WordPress-Coding-Standards
- Plugin Check: https://wordpress.org/plugins/plugin-check/
- WP-CLI commands: https://developer.wordpress.org/cli/commands/
- WordPress 7.0 hosting compatibility notes: https://make.wordpress.org/hosting/handbook/compatibility/version/7-0/

## Security and incidents

- OWASP Top 10 and Cheat Sheet Series: https://owasp.org/www-project-top-ten/ · https://cheatsheetseries.owasp.org/
- Patchstack, *State of WordPress Security in 2026*: https://patchstack.com/whitepaper/state-of-wordpress-security-in-2026/
- Wordfence Intelligence vulnerability database: https://www.wordfence.com/threat-intel/vulnerabilities/
- wp2shell (CVE-2026-63030, CVE-2026-60137) — Wiz analysis: https://www.wiz.io/blog/wp2shell-cve-2026-63030-cve-2026-60137
- PHP2Shell (CVE-2026-109618, CVE-2026-109619) — PHP Foundation: https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/ · NCSC-NL operational notes: https://github.com/NCSC-NL/php2shell
- AI-scale plugin vulnerability discovery (May 2026): https://www.helpnetsecurity.com/2026/05/22/ai-wordpress-plugin-vulnerabilities/
- Backdoored plugin detected within two hours (July 2026): https://www.wordfence.com/blog/2026/07/wordfence-prism-detected-backdoored-wordpress-plugin-within-two-hours-of-it-being-introduced/
- ShapedPlugin premium plugins backdoored (June 2026): https://thehackernews.com/2026/06/shapedplugin-wordpress-pro-plugins.html
- Laravel Lang packages hijacked (May 2026): https://www.bleepingcomputer.com/news/security/laravel-lang-packages-hijacked-to-deploy-credential-stealing-malware/
- WordPress.org plugin team status, June 2026: https://make.wordpress.org/plugins/2026/06/13/update-on-the-status-of-the-team-june-2026/

## Secrets

- GitGuardian, *State of Secrets Sprawl 2026*: https://www.gitguardian.com/state-of-secrets-sprawl-report-2026
- Laravel `APP_KEY` exposure research (July 2025): https://thehackernews.com/2025/07/over-600-laravel-apps-exposed-to-remote.html
- AI Engine CVE-2025-11749: https://www.sentinelone.com/vulnerability-database/cve-2025-11749
- gitleaks: https://github.com/gitleaks/gitleaks · TruffleHog: https://github.com/trufflesecurity/trufflehog
- `security.txt` (RFC 9116): https://www.rfc-editor.org/rfc/rfc9116

## Practice and law

- Regulation (EU) 2024/2847, the Cyber Resilience Act: https://eur-lex.europa.eu/eli/reg/2024/2847/oj
- European Accessibility Act, Directive (EU) 2019/882: https://eur-lex.europa.eu/eli/dir/2019/882/oj
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- FAIR Package Manager: https://github.com/fairpm
- The GPL and WordPress: https://wordpress.org/about/license/

---

<a id="campaign-ordering-volume-vii"></a>
# Campaign ordering suggestions

The modules are short on purpose. Pick one campaign; don't try to run two at once.

### The full practice
**M78 → M79 → M80 → M81 → M82**

Facts, then a place to record work, then the secrets, then the race, then the business that pays for it. This is the intended order.

### The security sprint
**M78 → M80 → M81**

If a client site is already worrying you, build the inventory, take control of the secrets, and get the patch pipeline running. Come back for M79 and M82 when the fire is out.

### The plugin author
**M78 → M79 → M82**

If you mean to sell or publish plugins rather than maintain sites: modern PHP, a plugin that passes review, and the disclosure policy and CRA note that come with selling code.

**M80's rotation drill runs alongside every campaign.** Rotate one secret at the end of each module, and time it.

---

<a id="closing-test-volume-vii"></a>
# Volume VII closing test

At the end, take a blank page and answer these without notes:

1. **What does each of your sites run, down to the PHP branch — and how do you know without executing anything?**
2. **For one of your REST routes: who is asking, may they do this, and did they mean to?**
3. **Name every secret on one site, what can read it, and how long it takes you to rotate it.**
4. **A critical plugin vulnerability is disclosed at 9 a.m. What happens on each site, in order, and by when?**
5. **An update you installed was the attack. How would you notice, and what do you do first?**
6. **WordPress is current and PHP isn't. Whose problem is that, in writing?**
7. **What does your cheapest care plan promise, and which measured minutes pay for it?**
8. **If you disappeared tomorrow, how would each client keep their site running?**
9. **Which of your conventions does CI enforce, and which only you remember?**
10. **Does the Cyber Resilience Act apply to you — and what would change the answer?**

If you can answer those across these five modules, Volume VII has done its job.
