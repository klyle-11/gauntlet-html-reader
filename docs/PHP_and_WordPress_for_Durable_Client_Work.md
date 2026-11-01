# PHP and WordPress for Durable Client Work

## An explanatory guide for JavaScript and Java developers, with plugin, maintenance and security examples

This book follows a recurring project: a small practice that builds and maintains WordPress sites for clients, and the tooling it needs to do that well — an inventory of what each site runs, a plugin that records maintenance, a way to keep credentials private and rotatable, and a pipeline for applying updates before attackers arrive. The project gives the language and the platform a concrete purpose. An array's copy-on-write behaviour is something that decides whether a helper can corrupt a caller's data; a capability check is something that decides whether a subscriber can delete a client's posts; a salt is something whose rotation logs out every user on the site.

The emphasis is on understanding why code behaves as it does. When a section introduces a term such as *shared-nothing*, *escaping context* or *blast radius*, it explains the condition that term describes, the mechanism involved, and the consequence for the running site. PHP and WordPress supply useful tools for building sites that last, but whether a site stays safe and maintainable still depends on design, review, operations and the agreements between the people involved.

The book is the companion to *The Gauntlet VII — Steward*. The Gauntlet asks you to make the decisions and write the code yourself; this book explains the mechanisms those decisions rest on, and the recent incidents that make them urgent.

### How to read the examples

The examples use PHP 8.4 or 8.5 and WordPress 7.0 unless a section says otherwise. Plain-PHP examples follow PSR-12/PER Coding Style; WordPress examples follow the WordPress Coding Standards, so you will see both styles, and Chapter 6 explains why. Each chapter develops its own small examples; repeated names such as `Plugin` or `example_log` are alternative teaching models, not files to combine. Short fragments are labelled as fragments and assume the surrounding context described in the text. None of the examples is a solution to a Gauntlet module.

Security incidents are described from public advisories and reporting available in November 2026. Version numbers and figures are given as reported; before acting on any of them, read the current advisory from the project or vendor concerned. No example in this book demonstrates an exploit.

The review questions are open-ended prompts for explaining mechanisms in your own words. Try answering them with a concrete sequence of events: which request arrives, which function runs, which value changes, what gets stored, and what another user or another request can observe.

## Contents

- [Chapter 0: PHP Primer for JavaScript Developers — Requests, Types, Arrays, and Objects](#chapter-0)
- [Chapter 1: Why PHP Still Runs So Much of the Web — Runtimes, Versions, and the Market](#chapter-1)
- [Chapter 2: Modern PHP as Architecture — Namespaces, Composer, Types, and Tools](#chapter-2)
- [Chapter 3: Input, Output, and Meaning — Validation, Escaping, SQL, and Serialization](#chapter-3)
- [Chapter 4: WordPress From the Inside — Boot, Hooks, Data, and Releases](#chapter-4)
- [Chapter 5: Plugins — Entry Points, Permissions, Blocks, and Distribution](#chapter-5)
- [Chapter 6: Conventions and Team Practice — Standards, Review, and the Tech Lead's Job](#chapter-6)
- [Chapter 7: Security in the WordPress Ecosystem — Classes, Cases, and AI on Both Sides](#chapter-7)
- [Chapter 8: Secrets — Inventory, Blast Radius, and Rotation](#chapter-8)
- [Chapter 9: Production WordPress — Capacity, Caching, Backups, and Updates](#chapter-9)
- [Chapter 10: The Industry, the Freelancer, and the Tech Lead — Market, Governance, Money, and Law](#chapter-10)
- [Glossary: Terms Used Throughout the Book](#glossary)
- [Technical References](#references)

<a id="chapter-0"></a>
# Chapter 0: PHP Primer for JavaScript Developers — Requests, Types, Arrays, and Objects

## 0.1 What changes when you move from JavaScript to PHP?

PHP and JavaScript share familiar surface features: variables, functions, closures, classes, exceptions and a C-like syntax. Both are dynamically typed at their core and both have grown optional type systems. The important differences are in how a program lives and dies, how values are copied, and what a single data structure is asked to do.

A Node.js server is usually one long-running process. It starts, loads its modules once, and then handles thousands of requests, keeping objects in memory between them. A conventional PHP application is started fresh for every request: the runtime loads the code, runs it, sends the response, and throws away every variable and object the request created. That one difference explains a great deal of PHP's history and many of its habits, from global variables that seemed harmless to frameworks that rebuild their configuration on every request.

The second difference is the array. JavaScript separates arrays from objects and maps. PHP has one structure, the array, that is both an ordered list and a dictionary, and it is copied on assignment unless you take deliberate steps. The third difference is the type system: PHP checks declared parameter and return types at runtime, and whether it converts a mismatched value or rejects it depends on a per-file setting.

## 0.2 Shared-nothing: one request, then everything is gone

The model PHP is known for is called *shared-nothing*. Each request starts with empty global state. If request A sets a variable, request B cannot see it. If request A creates an object that holds a large document, that memory is released when request A ends, whether or not the code remembered to release it. Persistent state lives outside the PHP process: in a database, a cache server, files, or the session store.

This model is forgiving. A memory leak cannot accumulate across requests, and one user's data cannot linger in a variable that the next user's request reads. It is also the reason a PHP site can be deployed by copying files to a server: there is no long-running application process to restart.

The guarantee has a precise owner, however, and it is not your code. In most deployments the *process* survives. PHP-FPM keeps a pool of worker processes; each worker serves a request, the engine resets the request's state, and the same worker then serves the next request. Shared-nothing is a promise the PHP engine makes by cleaning up between requests. When the engine's cleanup is wrong, the promise breaks. In October 2026, one of the two critical *PHP2Shell* vulnerabilities was described by the PHP project as remote code execution through request-owned global state that a later request on the same worker could reach. Chapter 7 returns to that case; the lesson here is that "nothing is shared" describes a mechanism with an implementation, not a law of nature.

Persistent application servers such as FrankenPHP's worker mode, RoadRunner and Swoole change the model on purpose. They boot the application once and keep it in memory, which can make requests much faster. They also make PHP behave more like Node.js: a static property set during one request is still set during the next, and a leak accumulates. Code written for shared-nothing PHP can be wrong in a worker without any syntax changing.

## 0.3 Types, juggling, and `strict_types`

PHP's scalar types are `int`, `float`, `string` and `bool`. Its compound types include `array`, `object`, `callable` and `iterable`, and it has `null`. Since PHP 7 and 8, functions can declare parameter, return and property types, including union types (`int|string`), nullable types (`?string`), `mixed`, `void`, `never`, and class and interface names.

What happens when a call passes the wrong scalar type depends on a declaration at the top of the *calling* file:

```php
<?php
// File: caller.php
declare(strict_types=1);

function pluginCount(int $count): string
{
    return "{$count} plugins";
}

echo pluginCount(5);     // "5 plugins"
echo pluginCount("5");   // TypeError: argument must be of type int, string given
```

Without `declare(strict_types=1)`, the second call would succeed: PHP would convert the numeric string `"5"` to the integer `5`. This conversion is called *type juggling* or *coercive typing*. It is the default, and it is the reason old PHP code could be loose about the difference between `"5"` and `5`.

The declaration is per file and applies to calls made *from* that file. A library compiled with strict types can still be called coercively by a file that does not declare them. Modern PHP projects put `declare(strict_types=1);` at the top of every file so that their own call sites behave predictably. WordPress core does not, and most WordPress plugins do not, which is one reason WordPress code and modern framework code can feel like different languages.

Comparisons have their own rules. `==` compares after juggling and `===` compares type and value. PHP 8 made `0 == "a"` false (it was true in PHP 7), which fixed one of the language's most famous surprises but also changed the behaviour of some old code. Use `===` unless you have a reason not to, and be explicit when you convert.

## 0.4 Arrays are ordered maps with value semantics

A PHP array maps keys to values and remembers insertion order. Keys are integers or strings. A "list" is simply an array whose keys happen to be `0, 1, 2, …`; PHP 8.1 added `array_is_list()` to check.

The important behavioural difference from JavaScript is that arrays are *values*. Assigning an array to another variable, or passing it to a function, gives the receiver its own logical copy:

```php
<?php
declare(strict_types=1);

function markChecked(array $plugin): array
{
    $plugin['checked'] = true;   // changes the function's copy only
    return $plugin;
}

$plugin = ['slug' => 'contact-form', 'checked' => false];
$result = markChecked($plugin);

var_dump($plugin['checked']);  // bool(false) — the caller's array is unchanged
var_dump($result['checked']);  // bool(true)
```

PHP does not physically copy the array at the moment of assignment. It shares the underlying storage and copies only when one side writes, a technique called *copy-on-write*. The observable behaviour is still that of a copy, which makes arrays safe to pass around: a helper cannot accidentally modify its caller's data.

Objects behave differently, as the next section shows. A codebase that represents its records as arrays gets value semantics for free and loses type information; one that represents them as objects gets types and must think about sharing. Modern PHP often uses `readonly` objects to get both.

## 0.5 Objects are handles; references are something else

A variable that holds an object holds a *handle* to it. Assigning the variable copies the handle, not the object, exactly as in JavaScript:

```php
<?php
declare(strict_types=1);

final class Counter
{
    public int $count = 0;
}

$first = new Counter();
$second = $first;
$second->count++;

echo $first->count; // 1 — both variables reach the same object
```

PHP also has *references*, written with `&`. A reference makes two names refer to the same variable slot, so assigning to one assigns to the other. References are used by some older APIs and by `foreach ($items as &$item)` loops. They are not the same as object handles, and they are a common source of bugs: a reference left over from a `foreach` loop will silently change the last element of the array the next time the loop variable is assigned. Prefer returning new values, or objects, to passing arrays by reference.

## 0.6 Null and missing values

PHP distinguishes `null`, an unset variable, and a missing array key, but it lets you read all three in ways that blur the difference. Reading an undefined array key produces `null` and a warning. The null coalescing operator `??` returns its right side when the left is `null` or undefined, without a warning, and the nullsafe operator `?->` stops a chain of calls when it meets `null`:

```php
<?php
// Fragment: $request is an array of decoded JSON; $site may be null.
$since   = $request['since'] ?? null;
$host    = $site?->url()?->host();
$retries = (int) ($config['retries'] ?? 3);
```

These operators make code shorter; they also make it easy to hide a missing value that should have been an error. A configuration file that lacks its database password should stop the application, not let it run with `null`. Decide for each value whether "absent" means "use a default", "the caller made a mistake", or "the system is broken", and write code that says which.

## 0.7 Strings are bytes

A PHP string is a sequence of bytes with no attached encoding. `strlen('é')` is `2` in a UTF-8 file because `é` takes two bytes. Functions such as `strlen`, `substr` and `strtoupper` work on bytes; the `mbstring` extension provides character-aware versions such as `mb_strlen` and `mb_substr`, and the `intl` extension handles graphemes, collation and normalization.

This matters wherever you cut or count text: truncating an excerpt with `substr` can split a character in half and produce invalid UTF-8, which some escaping functions will then reject or replace. WordPress assumes UTF-8 almost everywhere; your code should too, and it should use the multibyte functions when it measures text for people.

## 0.8 Errors, exceptions, and the warning that keeps going

PHP has two overlapping failure systems. *Exceptions* (`Throwable`, with `Exception` and `Error` beneath it) unwind the stack until something catches them. *Diagnostics* — notices, warnings and deprecations — are reported and then execution continues. PHP 8 turned many former warnings into exceptions — dividing by zero now throws `DivisionByZeroError`, and built-in functions throw `TypeError` or `ValueError` for invalid arguments — but plenty of functions still signal failure by returning `false` or `null` and emitting a warning.

The result is code that "works" after something went wrong. `file_get_contents()` on a missing file returns `false` with a warning; if the caller passes that `false` to a JSON decoder, the eventual failure appears far from its cause. Ask for exceptions where the API offers them — `json_decode($text, flags: JSON_THROW_ON_ERROR)` is the standard example — check return values where it doesn't, and configure production to log diagnostics rather than display them, because a displayed warning can reveal file paths and configuration to a visitor.

### Review questions

1. Why can a memory leak in a conventional PHP request not accumulate over days, and what changes in a persistent worker?
2. In which file must `declare(strict_types=1)` appear to make a particular call strict?
3. Why can a function that receives an array not change the caller's array, while a function that receives an object can change the caller's object?
4. Which piece of software is responsible for the shared-nothing guarantee, and what happens when it is wrong?
5. When should a missing configuration value stop the program rather than fall back to a default?

<a id="chapter-1"></a>
# Chapter 1: Why PHP Still Runs So Much of the Web — Runtimes, Versions, and the Market

## 1.1 The practical problem PHP solved

PHP began in the mid-1990s as a way to put small pieces of server-side logic inside HTML pages. Its deployment model was its advantage: copy a `.php` file to a web server, request its URL, and the server runs it. There was no build, no process to supervise and no framework to learn. Shared hosting providers could put thousands of customers on one machine, each uploading files over FTP, and PHP became the default language of cheap, ubiquitous hosting.

That history explains two things you will meet constantly. First, the installed base is enormous and old: a great deal of PHP in production was written for versions and practices that are long gone. Second, the deployment model shaped the ecosystem's applications. WordPress, Drupal, Joomla, Magento and MediaWiki all assume that someone with modest technical skills can install them on ordinary hosting. That assumption is a strength — it is why these systems spread — and a security burden, because the people running them often have no one whose job is to patch them.

## 1.2 Runtime models: from CGI to persistent workers

How PHP is attached to the web server affects performance, isolation and which bugs can reach you.

| Model | How it works | What to remember |
| --- | --- | --- |
| CGI | The web server starts a new PHP process for each request. | Slow, rarely used for sites today. Arguments passed to the process were the root of 2024's CVE-2024-4577 on Windows. |
| `mod_php` | PHP runs inside each Apache worker process. | Simple; every Apache worker carries PHP. The demonstrated application-independent path for 2026's PHP2Shell bugs was `mod_php`. |
| PHP-FPM | A separate pool of PHP worker processes; the web server forwards requests over FastCGI. | The common modern setup with Nginx or Apache. Each pool can run as its own user with its own settings. |
| Persistent workers | FrankenPHP worker mode, RoadRunner, Swoole: the application boots once and serves many requests in memory. | Much faster for heavy frameworks; shared-nothing is no longer the default, so code must be written for it. |

In 2025 the PHP Foundation took FrankenPHP under its umbrella, a sign that persistent workers are becoming part of mainstream PHP rather than a niche. WordPress, with its globals and its assumption of a fresh start, still runs almost everywhere in the per-request models.

## 1.3 OPcache: what "compiled" means for PHP

PHP compiles source code to an internal bytecode called *opcodes* before executing it. Without a cache, every request recompiles every file it includes. The OPcache extension stores compiled opcodes in shared memory so that later requests skip compilation. On any production site OPcache should be enabled; its memory size and its settings for checking file timestamps affect both performance and how quickly a deployed change takes effect.

PHP 8.0 added a just-in-time compiler that can turn hot opcodes into machine code. It helps CPU-bound work such as image processing or mathematical code. A typical WordPress request spends its time waiting on the database and building strings, so JIT usually makes little difference there. Measure before enabling it.

## 1.4 Versions and support windows

Each PHP minor version receives two years of active support (bug and security fixes) followed by two years of security-only fixes, ending on 31 December of the final year. The practical consequences in November 2026:

- **PHP 8.1** reached end of life on 31 December 2025.
- **PHP 8.2** receives security fixes until 31 December 2026 — two months from the time of writing.
- **PHP 8.3, 8.4 and 8.5** are supported; 8.5 was released on 20 November 2025.
- **PHP 8.6** is scheduled for general availability on 19 November 2026.

When PHP2Shell was patched on 21 October 2026, fixed releases appeared for 8.2, 8.3, 8.4 and 8.5. Branches 7.4, 8.0 and 8.1, which many WordPress sites still run, received no official fix. Some Linux distributions and commercial vendors backport fixes to versions the PHP project no longer supports, so "end of life" means "the PHP project has stopped", not necessarily "nobody will patch it". Find out which of those situations each of your sites is in.

WordPress has its own requirements. WordPress 7.0, released on 20 May 2026, raised the minimum PHP version from 7.2.24 to 7.4; sites on 7.2 or 7.3 stay on the 6.x branch. The WordPress hosting handbook recommends PHP 8.4 or 8.5 for new installations. The gap between "minimum" and "recommended" is where many client sites live.

## 1.5 Where PHP sits in 2026

W3Techs, which surveys the server-side technologies it can detect on popular websites, reported in the second half of 2026 that PHP was used by roughly 70% of sites whose server-side language it could identify. WordPress alone accounted for roughly 40% of all websites in October 2026, and close to 60% of sites using a recognisable content management system. Both numbers had drifted down from their peaks — WordPress was reported at about 43.6% in mid-2025 — as hosted site builders, headless architectures and JavaScript frameworks took share.

Beyond WordPress, PHP's major frameworks are Laravel and Symfony, with Drupal, Magento (Adobe Commerce), Joomla and many in-house applications built on them or alongside them. The language's governance has also changed: since 2021 the PHP Foundation has funded core developers, and in October 2026 it described a strengthened security process after PHP2Shell's disclosure embargo was broken.

For a developer deciding whether PHP is worth learning, the numbers mean something specific. The work is not mainly greenfield applications. It is the maintenance, extension and rescue of a very large installed base — and in 2026, the security of that base is under unusual pressure.

### Review questions

1. Why did PHP's file-upload deployment model help WordPress spread, and what security burden came with it?
2. Which runtime model was the demonstrated path for PHP2Shell, and how does a persistent worker change what "shared-nothing" means?
3. What does OPcache cache, and why might enabling JIT not speed up a WordPress site?
4. A client's host runs PHP 8.1. What changed for that site on 31 December 2025, and what did October 2026 add?
5. What does a 40% market share imply about the kind of work a PHP developer is likely to be paid for?

<a id="chapter-2"></a>
# Chapter 2: Modern PHP as Architecture — Namespaces, Composer, Types, and Tools

## 2.1 Namespaces and autoloading

A namespace such as `Steward\Inventory` gives related classes a shared prefix, so that your `Plugin` class does not collide with another library's `Plugin` class. A file declares its namespace at the top and imports names from other namespaces with `use`.

PHP does not load a class file until something asks for the class. An *autoloader* is a function registered with the runtime that receives a class name and loads the file that defines it. The PSR-4 standard defines a mapping from namespace prefixes to directories: the class `Steward\Inventory\Plugin` lives in `src/Inventory/Plugin.php` if the prefix `Steward\` maps to `src/`.

```json
{
    "name": "example/steward",
    "type": "project",
    "require": {
        "php": ">=8.4"
    },
    "require-dev": {
        "phpstan/phpstan": "^2.1",
        "pestphp/pest": "^4.0"
    },
    "autoload": {
        "psr-4": { "Steward\\": "src/" }
    },
    "bin": ["bin/steward"]
}
```

Composer reads this `composer.json`, writes an autoloader to `vendor/autoload.php`, and every entry point includes that one file. The first time code writes `new Steward\Inventory\Plugin(...)`, the autoloader converts the name to a path and includes it. Nothing else needs to know where files live.

## 2.2 Composer: what a lock file promises

Composer resolves the version constraints in `composer.json` — `^2.1` means "2.1 or later, below 3.0" — to exact versions, downloads them into `vendor/`, and records the exact versions and content hashes in `composer.lock`.

The two install commands promise different things. `composer update` re-resolves constraints and may choose newer versions; it rewrites the lock file. `composer install` installs exactly what the lock file says. An application commits its lock file and deploys with `install`, so that what runs in production is what was tested. A library usually does not commit one, because its users resolve its dependencies together with their own.

A lock file is a supply-chain control, but only a partial one. It pins versions and hashes of distribution archives; it cannot tell you whether a version was malicious when you first locked it. In May 2026, attackers who gained control of the `laravel-lang` packages rewrote existing Git tags so that familiar version numbers pointed at malicious commits, and the payload ran from a file registered for automatic loading. A project that ran `composer update` during that window could lock the malicious code; a project that only ran `install` against an older lock file was protected, because its lock file recorded the commit each version had pointed to, not just the tag's name. `composer audit` checks installed versions against published advisories, and recent Composer versions can refuse to resolve to versions with known advisories during an update — check how your version is configured rather than assuming.

## 2.3 Classes that state their promises

Modern PHP gives classes several ways to say what they guarantee. Constructor promotion declares and assigns properties in one place. `readonly` properties can be assigned once, from inside the class, and never changed afterwards; a `readonly` class makes every property readonly. *Enums* define a closed set of named values; a *backed* enum attaches a string or integer to each case for storage and serialisation.

```php
<?php
declare(strict_types=1);

namespace Steward\Inventory;

enum ComponentKind: string
{
    case Plugin = 'plugin';
    case Theme = 'theme';
    case MustUse = 'mu-plugin';
    case DropIn = 'drop-in';
}

final readonly class Component
{
    public function __construct(
        public ComponentKind $kind,
        public string $slug,
        public ?string $version,
        public ?string $requiresPhp,
    ) {
    }
}
```

`ComponentKind::from('theme')` returns the `Theme` case; `ComponentKind::from('widget')` throws a `ValueError`; `tryFrom` returns `null` instead. A `Component` cannot be half-built or modified after construction. A function that receives one can rely on its kind being one of four values and its slug being a string, and a static analyser can check every caller.

These are the same tools you would reach for in TypeScript or Java. The difference is cultural: much PHP in the wild represents records as associative arrays, and much WordPress code passes `$args` arrays whose shape is documented only in comments.

## 2.4 PHP 8.4: property hooks and asymmetric visibility

PHP 8.4 added two features that let a class expose properties without writing getters and setters for everything. *Asymmetric visibility* sets different visibility for reading and writing: `public private(set)` can be read from anywhere but written only inside the class. *Property hooks* attach `get` and `set` behaviour to a property; a property with only a `get` hook that does not use its own stored value is *virtual*, computed on each read.

```php
<?php
declare(strict_types=1);

final class CoreVersion
{
    public function __construct(
        public private(set) string $raw,
    ) {
    }

    // Virtual property: computed on every read, never stored.
    public bool $isPrerelease {
        get => (bool) preg_match('/-(alpha|beta|RC)\d*$/i', $this->raw);
    }
}

$v = new CoreVersion('7.0-RC1');
var_dump($v->isPrerelease); // bool(true)
$v->raw = '7.0';            // Error: cannot modify private(set) property
```

PHP 8.4 also allowed `new CoreVersion('7.0')->raw` without wrapping parentheses, added `array_find()`, `array_find_key()`, `array_any()` and `array_all()`, introduced a `#[\Deprecated]` attribute for your own functions, added a standards-compliant HTML5 parser under the `Dom` namespace, and deprecated *implicitly nullable* parameters (`string $s = null` must now be written `?string $s = null`). That last change produces deprecation notices in a great deal of older WordPress plugin code.

## 2.5 PHP 8.5: pipes, `clone with`, and a URI parser

PHP 8.5, released on 20 November 2025, added the pipe operator `|>`, which passes the value on its left as the single argument of the callable on its right. Long chains of nested calls read left to right instead of inside out:

```php
<?php
declare(strict_types=1);

$slug = '  Contact Form 7  '
    |> trim(...)
    |> strtolower(...)
    |> (fn (string $s): string => str_replace(' ', '-', $s));

echo $slug; // contact-form-7
```

`trim(...)` is a *first-class callable*: the function itself, not a call to it. Arrow functions on the right side of a pipe must be wrapped in parentheses.

PHP 8.5 also added `clone` with a list of properties to change, which makes "wither" methods on readonly objects concise when called from inside the class (`return clone($this, ['version' => $version]);`); a `#[\NoDiscard]` attribute that warns when a caller ignores a function's return value; `array_first()` and `array_last()`; and a URI extension with two parsers, `Uri\Rfc3986\Uri` and `Uri\WhatWg\Url`, that follow published standards. The older `parse_url()` follows neither standard exactly, and disagreements between how two components parse the same URL are a classic source of server-side request forgery and open-redirect bugs. PHP 8.5 also deprecated the backtick operator as an alias for `shell_exec()`.

PHP 8.6, due on 19 November 2026, is expected to add *partial function application*, which lets you fix some of a function's arguments with placeholders and receive a closure for the rest, along with smaller additions such as `clamp()`. Treat its details as provisional until the release notes are published.

## 2.6 Static analysis and tests

Because PHP checks types at runtime, a type error in a branch your tests never run is still a type error in production. Static analysers read the code without running it and report what would fail. PHPStan and Psalm are the two main tools; both understand generics written in PHPDoc comments, such as `list<Component>` and `array<string, Component>`, which the language itself cannot express.

PHPStan reports at levels from 0 to its maximum; each level adds checks. A new project can start at the maximum level. An existing one usually starts low and records existing problems in a *baseline* file so that only new problems fail the build — a useful bridge that becomes harmful if nobody ever shrinks it. For WordPress code, stubs describing WordPress's functions and an extension that understands its conventions let the analyser check calls into core.

Rector rewrites code automatically: upgrading syntax to a newer PHP version, applying refactorings, or removing deprecated patterns. PHPUnit is the standard test framework; Pest is a test framework built on it with a more compact syntax. WordPress has its own test scaffolding that boots a real WordPress against a test database for integration tests.

## 2.7 Standards beyond syntax

The PHP Framework Interop Group publishes *PSRs*, recommendations that let libraries cooperate. The ones you will meet most are PSR-4 (autoloading), PSR-12 and its successor PER Coding Style (formatting), PSR-3 (a logger interface), PSR-7 and PSR-17 (HTTP message objects and factories), PSR-15 (HTTP middleware), and PSR-11 (a container interface). Laravel and Symfony applications follow them closely. WordPress predates most of them and follows its own coding standards; Chapter 6 deals with what that means for a team.

### Review questions

1. What does an autoloader do the first time a class is used, and what does PSR-4 add?
2. Why does an application commit `composer.lock` and deploy with `composer install`?
3. What did rewriting Git tags let the `laravel-lang` attackers do, and which projects did a lock file protect?
4. What does a virtual property with a `get` hook guarantee that a public field does not?
5. Why can two URL parsers that disagree about one string create a security bug?

<a id="chapter-3"></a>
# Chapter 3: Input, Output, and Meaning — Validation, Escaping, SQL, and Serialization

## 3.1 Where input comes from

Input is any value your code did not create. In a PHP request it arrives through the superglobals `$_GET`, `$_POST`, `$_COOKIE`, `$_FILES` and `$_SERVER` (which includes request headers), through the raw request body from `php://input`, and through anything read from outside the process: the database, files, environment variables, other services' responses. In WordPress, it also arrives through hooks — a filter receives a value that another plugin may have produced.

Stored data deserves a special mention because it is easy to trust. A comment saved yesterday by an anonymous visitor is still input today, when your code reads it from the database and prints it on a page. Many stored cross-site scripting vulnerabilities come from code that sanitised input on its way in and then echoed the stored value without escaping it on the way out.

## 3.2 Validate, sanitise, escape: three different jobs

These words are often used interchangeably. They describe different operations at different moments.

| Operation | When | Question it answers | Example |
| --- | --- | --- | --- |
| Validate | On input | Is this value acceptable at all? | Is this an integer between 1 and 100? Reject if not. |
| Sanitise | On input | Can I clean this into an acceptable form? | Strip tags from a name; normalise whitespace. |
| Escape | On output | How do I write this value so the destination treats it as data? | Convert `<` to `&lt;` before placing text in HTML. |

Validation is the strongest: a value that fails is rejected. Sanitising is a compromise for free-form input. Escaping is not about whether the value is acceptable; it is about the *destination*. The same string needs different escaping in HTML text, an HTML attribute, a URL, a JavaScript string, a SQL statement and a shell command, because each destination has different characters with special meaning.

That is why "escape late" is the rule. Escaping depends on the output context, and only the code that writes the output knows the context. A value escaped for HTML when it was stored will be double-escaped in some places and wrongly escaped in others.

## 3.3 Escaping HTML in plain PHP

The core function for HTML is `htmlspecialchars()`. It converts `&`, `<`, `>`, `"` and, with the right flags, `'`, into entities. Since PHP 8.1 its default flags include `ENT_QUOTES` and `ENT_SUBSTITUTE`, and its default encoding is UTF-8, but code that must run on older versions should pass them explicitly:

```php
<?php
declare(strict_types=1);

function e(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$name = $_GET['name'] ?? '';
echo '<p>Hello, ' . e($name) . '</p>';
echo '<input value="' . e($name) . '">';
```

`htmlspecialchars` makes a value safe inside HTML text and inside a quoted attribute. It does not make a value safe inside an unquoted attribute, a `<script>` block, a `style` attribute, or an `href` (where `javascript:` URLs are a separate danger). WordPress provides one escaping function per context — `esc_html()`, `esc_attr()`, `esc_url()`, `esc_js()`, `wp_json_encode()` for data placed into scripts, and `wp_kses()` with an allow-list for markup you mean to keep — and its review tools check that you used one.

## 3.4 SQL: keep data out of the statement

SQL injection happens when a value becomes part of the SQL text and is parsed as SQL. The defence is to send the statement and the values separately, so the database never parses the values as syntax. In plain PHP, PDO prepared statements do this:

```php
<?php
declare(strict_types=1);

// Fragment: $pdo is a configured PDO connection with ERRMODE_EXCEPTION.
$sql = 'SELECT id, kind, created_at FROM maintenance_events
        WHERE site = :site AND created_at >= :since
        ORDER BY created_at DESC';

$statement = $pdo->prepare($sql);
$statement->execute([
    'site'  => $site,
    'since' => $since->format('Y-m-d H:i:s'),
]);
$rows = $statement->fetchAll(PDO::FETCH_ASSOC);
```

Placeholders work for values, not for identifiers or keywords. A table name, a column used for sorting or a sort direction cannot be bound; it must be chosen from a fixed allow-list in code. WordPress's `$wpdb->prepare()` performs a similar job with `%s`, `%d`, `%f` and `%i` (for identifiers, since WordPress 6.2) placeholders, though it builds an escaped SQL string rather than sending values separately. The rule is the same: no variable is concatenated into SQL.

The *wp2shell* chain of July 2026 ended in a SQL injection inside WordPress core. Core is reviewed more heavily than almost any plugin. If a query built from request data can go wrong there, it can go wrong in your plugin, and the only reliable protection is a habit that never makes exceptions.

## 3.5 Serialization: when data becomes objects

PHP's `serialize()` turns values, including objects, into a string; `unserialize()` turns the string back into values, *creating objects of whatever classes the string names*. When an object is created or destroyed, PHP calls its magic methods such as `__wakeup()` and `__destruct()`. If an attacker controls the string, they choose which classes are instantiated and what their properties contain, and a chain of ordinary classes whose magic methods do file or network operations can become code execution. This is *PHP object injection*, and it appears regularly in WordPress plugin advisories.

The 2025 research into leaked Laravel `APP_KEY` values shows how a secret and this mechanism combine. Laravel uses its application key to encrypt cookies and other values, and its `decrypt()` function unserialises the decrypted data by default. An attacker with a leaked key can encrypt a payload of their choosing, the application will decrypt and unserialise it, and object injection follows. GitGuardian and Synacktiv reported finding more than 260,000 Laravel `APP_KEY` values exposed on GitHub between 2018 and May 2025, and identified hundreds of live applications that were vulnerable as a result. The vulnerability was not in the cryptography; it was in giving untrusted data — data whose integrity depended on one leakable secret — to a function that creates objects.

The defences are simple to state. Do not call `unserialize()` on data that crosses a trust boundary; use JSON, which produces only arrays and scalars. If you must unserialise, pass `['allowed_classes' => false]` or an explicit list. WordPress stores serialised arrays in options and metadata through `maybe_serialize()` and `maybe_unserialize()`, which is one reason a SQL injection that lets an attacker write to those tables can escalate further.

## 3.6 Files and uploads

An uploaded file has a client-supplied name, a client-supplied MIME type and contents that may be anything. The safe pattern is to validate the type from the contents, generate your own filename, store uploads outside the web root or in a directory where the server will not execute scripts, and serve them with the right content type. A `.php` file written into a directory the web server executes is the most common way a vulnerability turns into a persistent backdoor. In WordPress, `wp_handle_upload()` and the media functions apply many of these checks; code that writes files directly bypasses them.

## 3.7 URLs and the server-side request

When a server fetches a URL that a user supplied — to import a feed, check a link or call a webhook — the user can point it at addresses only the server can reach: `localhost`, a cloud metadata endpoint, an internal admin panel. This is *server-side request forgery*. Defending against it requires parsing the URL the same way the HTTP client will, resolving the host, rejecting private and link-local addresses, and refusing redirects to them. WordPress provides `wp_safe_remote_get()` and related functions, which reject some internal destinations by default. PHP 8.5's standards-based URI parsers reduce the parser-disagreement problem; they do not decide which destinations are allowed.

### Review questions

1. Why is a value read from your own database still input?
2. A value is stored after `sanitize_text_field()`. Why must the code that prints it still escape it?
3. Which parts of a SQL statement can never be bound as parameters, and how should code handle them?
4. Explain, as a sequence of events, how a leaked Laravel `APP_KEY` led to code execution.
5. Why does storing uploads where the web server will not execute PHP matter even if your validation is perfect?

<a id="chapter-4"></a>
# Chapter 4: WordPress From the Inside — Boot, Hooks, Data, and Releases

## 4.1 What happens on a WordPress request

Follow one front-end request before naming the parts. A visitor asks for `/about/`. The web server sends the request to `index.php`, which loads `wp-blog-header.php`, which loads `wp-load.php`, which finds and loads `wp-config.php`. The configuration file defines database credentials, keys and salts, and settings, then loads `wp-settings.php`, which boots everything else:

1. Core libraries load, the database connection is created, and the object cache starts.
2. **Must-use plugins** in `wp-content/mu-plugins` load, in alphabetical order, with no way to deactivate them from the admin.
3. **Active plugins** load, in the order stored in the `active_plugins` option.
4. Pluggable functions that plugins did not replace are defined.
5. The **active theme** loads, including its `functions.php` (a child theme's first, then its parent's).
6. The `init` action fires, then `wp_loaded`.
7. WordPress parses the URL into query variables, runs the **main query**, and fires `template_redirect`.
8. The template loader picks a theme template for the result, the template renders HTML, and `shutdown` fires.

REST API requests take the same boot path and then dispatch to a registered route instead of loading a template. Admin requests load `wp-admin` files and fire their own actions such as `admin_init` and `admin_menu`.

Two consequences matter for everything later. Every active plugin's main file runs on every request, front end and admin alike, before most of WordPress is ready; plugins do their real work by attaching to later hooks. And every plugin runs with the same privileges as core: it can read `wp-config.php`'s constants, query any table and write any file the PHP user can write. There is no sandbox between plugins.

## 4.2 Hooks: the extension contract

WordPress's extension model is a set of named moments. An *action* is a moment at which WordPress calls every function attached to it: "this has happened; do something". A *filter* passes a value through every attached function, each of which returns a possibly modified value: "this value is passing; change it if you need to".

```php
<?php
// Fragment from a plugin's main file.

add_action( 'init', 'example_log_register_post_type' );

add_filter( 'the_content', 'example_log_append_notice', 20 );

function example_log_append_notice( string $content ): string {
	if ( ! is_singular( 'post' ) ) {
		return $content;
	}
	return $content . '<p class="example-log-notice">' . esc_html__( 'Maintained by Example.', 'example-log' ) . '</p>';
}
```

The third argument is the *priority*: lower numbers run first, and the default is 10. A fourth argument says how many parameters the callback accepts; it defaults to one, and a filter that passes extra context gives it to you only if you ask. Because every plugin attaches to the same hooks, ordering conflicts are common: two plugins filtering `the_content` at the same priority run in the order they were attached, which depends on plugin load order.

Hooks are also a security surface. A filter receives whatever earlier callbacks returned, which may include another plugin's unescaped output; an action may fire in contexts you did not expect, such as during a REST request or a cron run where there is no current user. Query Monitor, a free developer plugin, shows which hooks fired on a page and which callbacks ran, and is worth installing on every development site.

## 4.3 The data model

WordPress stores almost everything in a handful of tables. The names below omit the configurable table prefix, usually `wp_`.

| Table | Holds | Notes |
| --- | --- | --- |
| `posts` | Posts, pages, attachments, revisions, menu items, block templates, and every custom post type | Distinguished by `post_type` and `post_status`. |
| `postmeta` | Key–value metadata for posts | Unindexed values; querying by meta value is slow at scale. |
| `options` | Site-wide settings, plugin settings, transients | Rows marked for autoloading are read on every request. |
| `users`, `usermeta` | Accounts and per-user data | Roles and capabilities are stored in user meta as serialised arrays. |
| `terms`, `term_taxonomy`, `term_relationships`, `termmeta` | Categories, tags and custom taxonomies | |
| `comments`, `commentmeta` | Comments | |

The model is flexible enough that most plugins never create a table: a "booking" becomes a custom post type, its date becomes post meta, and its settings become an option. That flexibility has costs. Post meta is a key–value store without types or useful indexes on values, so a plugin that stores thousands of records as meta and filters by value will slow down as it grows. The options table is read selectively, but all autoloaded rows are loaded into memory at the start of every request; a plugin that autoloads a large log or cache adds that cost to every page view, for every visitor, forever. Recent WordPress versions have become more careful about autoloading large values by default, but the decision still belongs to the code that calls `add_option()` or `update_option()`.

Capabilities deserve their own note. A *role* such as Editor is a named set of *capabilities* such as `edit_others_posts`. Code should check capabilities, not roles: `current_user_can( 'edit_post', $post_id )` asks whether this user may edit this specific post, and WordPress maps that *meta capability* to primitive capabilities using the post's author and status. Checking `is_user_logged_in()` or a role name where a capability was meant is one of the most common plugin vulnerabilities.

## 4.4 Queries

`WP_Query` is the main interface for fetching posts. It takes an array of arguments — post type, status, taxonomy terms, meta conditions, ordering, pagination — and builds SQL, runs it, and primes caches. The main query for a page is a `WP_Query` built from the URL; secondary queries in templates and plugins create their own.

For anything `WP_Query` and the other APIs do not cover, `$wpdb` is WordPress's database object. It offers `get_results()`, `get_var()`, `insert()`, `update()` and `delete()`, and `prepare()` for building SQL with placeholders. The insert, update and delete helpers take data arrays and escape the values themselves; hand-written SQL must go through `prepare()`. The higher-level APIs also fire hooks and update caches, which hand-written SQL bypasses — another reason to prefer them.

## 4.5 Caching layers

WordPress has three layers of caching that are easy to confuse.

The **object cache** stores results of expensive lookups — options, posts, users, query results — in memory. By default it lasts for one request only. A drop-in file, `wp-content/object-cache.php`, can replace it with a persistent backend such as Redis or Memcached, so cached objects survive between requests and across servers.

**Transients** are values with an expiry time stored through `set_transient()`. Without a persistent object cache they live in the options table; with one, they live in the cache. Code must always handle a missing transient, because it can disappear at any time.

**Page caching** stores the entire HTML of a response and serves it without running WordPress at all. It is provided by hosts, by a reverse proxy or CDN, or by a plugin using the `advanced-cache.php` drop-in. A page cache can make a site dramatically faster and also serve one user's personalised page to another if it is configured carelessly.

## 4.6 WP-Cron is not cron

WordPress schedules background work — publishing scheduled posts, checking for updates, sending queued email — through WP-Cron. It is not a system scheduler. On each page load, WordPress checks whether any scheduled event is due and, if so, makes a request to `wp-cron.php` to run it. On a quiet site, tasks run late; on a busy one, the checks add load. Production sites usually set `DISABLE_WP_CRON` to `true` in `wp-config.php` and have the system scheduler run due events every few minutes, with `wp cron event run --due-now` or a request to `wp-cron.php`. For a maintenance practice, this matters because the automatic update check is itself a cron event.

## 4.7 What changed in 6.8, 6.9 and 7.0

Three releases between April 2025 and May 2026 changed things a maintainer needs to know.

**WordPress 6.8** (April 2025) switched password hashing to bcrypt, replacing the long-standing phpass portable hashes, with existing hashes upgraded as users log in. It also added speculative loading, which lets supporting browsers prefetch or prerender likely next pages.

**WordPress 6.9** (December 2025) added the **Abilities API**, a registry in which core and plugins declare named actions — with a description, input and output schemas, an execution callback and a permission callback — so that other code, including AI agents, can discover and call them. It also added block-level *Notes*, comments attached to blocks in the editor.

**WordPress 7.0**, "Armstrong", released on 20 May 2026, refreshed the admin interface, expanded Notes, and added the **AI Client**: a provider-agnostic PHP interface through which plugins can send prompts to AI services. Core bundles no AI provider and makes no AI calls by default; providers are added by plugins and configured with the site owner's credentials. 7.0 also allows blocks to be registered entirely in PHP, without a JavaScript build, and raised the minimum PHP version to 7.4. A separate **MCP Adapter** plugin exposes registered abilities as Model Context Protocol tools, so that external AI agents can call them.

Together, the AI Client makes WordPress a *caller* of AI services and the Abilities API with the MCP Adapter makes it something AI agents *call*. Both directions carry security weight: the first adds provider credentials to the site (Chapter 8), and the second adds a new class of entry point whose permission callbacks must be as careful as any REST route's (Chapter 5).

### Review questions

1. In what order do must-use plugins, regular plugins and the theme load, and why does that order matter to a plugin's main file?
2. What is the difference between an action and a filter, and what does a filter callback owe the code that called it?
3. Why can a plugin that autoloads a large option slow down every page on a site?
4. Why should code check `edit_post` for a specific post rather than whether the user is an Editor?
5. What does the Abilities API add to a site's attack surface, and which part of an ability must you get right?

<a id="chapter-5"></a>
# Chapter 5: Plugins — Entry Points, Permissions, Blocks, and Distribution

## 5.1 Anatomy of a plugin

A plugin is a directory in `wp-content/plugins` containing a PHP file whose first comment block is a header:

```php
<?php
/**
 * Plugin Name:       Example Log
 * Description:       Records maintenance events and shows a summary.
 * Version:           1.0.0
 * Requires at least: 7.0
 * Requires PHP:      8.2
 * Author:            Example Studio
 * License:           GPL-2.0-or-later
 * Text Domain:       example-log
 */

defined( 'ABSPATH' ) || exit;
```

The header is how WordPress lists the plugin; `Requires at least` and `Requires PHP` stop it from being activated where it cannot run. The `ABSPATH` check stops the file from doing anything if a visitor requests it directly. Everything the plugin defines in the global namespace — functions, constants, option names, hook names, database tables, CSS classes — shares one space with core and every other plugin, so each needs a distinctive prefix, or the code lives in a PHP namespace and only the unavoidable global names are prefixed.

A plugin has three lifecycle events. Activation runs a callback registered with `register_activation_hook()`; it is the place to create tables or default options. Deactivation runs another; it should stop scheduled events and leave data in place, because users deactivate plugins to troubleshoot. Uninstall runs `uninstall.php` (or a registered callback) when the user deletes the plugin; it should remove the plugin's data, and nothing else.

## 5.2 Entry points

A plugin's attack surface is the set of ways a request can reach its code. Listing them is the first step of any review.

| Entry point | Registered with | Who can reach it by default |
| --- | --- | --- |
| Admin page | `add_menu_page()`, `add_submenu_page()` | Users with the capability you pass |
| Form handler | `admin_post_{action}`, `admin_post_nopriv_{action}` | Logged-in users; *anyone* for `nopriv` |
| AJAX handler | `wp_ajax_{action}`, `wp_ajax_nopriv_{action}` | *Any logged-in user*, including subscribers; *anyone* for `nopriv` |
| REST route | `register_rest_route()` | Whoever its `permission_callback` allows |
| Ability | the Abilities API | Whoever its permission callback allows — including AI agents through the MCP Adapter |
| Shortcode, block render | `add_shortcode()`, `register_block_type()` | Anyone who can view content containing it, with attributes chosen by anyone who can edit it |
| Cron event | `wp_schedule_event()` | Runs with no current user |
| WP-CLI command | `WP_CLI::add_command()` | Shell users |
| Hook callback | `add_action()`, `add_filter()` | Whatever triggers the hook |

The AJAX row is the one that surprises people. `wp_ajax_{action}` handlers run for *any* logged-in user, so an "admin-only" AJAX action without a capability check is available to every subscriber — and on sites with open registration, anyone can become a subscriber. A large share of plugin privilege-escalation advisories have exactly this shape.

## 5.3 Authentication, capability, nonce

Three different questions must be answered before a handler changes anything:

- **Authentication — who is this?** WordPress identifies users through its login cookie, or through application passwords and other mechanisms for API clients.
- **Authorisation — may they do this?** A capability check: `current_user_can( 'manage_options' )`, or a capability specific to your plugin.
- **Intent — did they mean to?** A nonce, a token tied to the user, the action and a time window, embedded in the form or request so that a hostile page cannot make the user's browser submit the request. This is protection against cross-site request forgery.

None of the three replaces another. A nonce does not prove that a user may perform an action: a subscriber can obtain a valid nonce for an action that appears on a page they can view. A capability check does not prove intent. The REST API handles authentication itself and requires a nonce (in the `X-WP-Nonce` header) for cookie-authenticated requests; it leaves authorisation to the route's `permission_callback`.

```php
<?php
// Fragment from a plugin that registers a REST route.

add_action( 'rest_api_init', 'example_log_register_routes' );

function example_log_register_routes(): void {
	register_rest_route(
		'example-log/v1',
		'/entries',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'example_log_create_entry',
			'permission_callback' => static function (): bool {
				return current_user_can( 'example_log_write' );
			},
			'args'                => array(
				'kind' => array(
					'type'     => 'string',
					'enum'     => array( 'update', 'backup', 'rotation', 'incident' ),
					'required' => true,
				),
				'note' => array(
					'type'              => 'string',
					'sanitize_callback' => 'sanitize_text_field',
				),
			),
		)
	);
}
```

The permission callback runs before the handler. It returns `true` to allow the request, `false` to refuse it, or a `WP_Error` to refuse it with a specific message. Since WordPress 5.5, registering a route without a permission callback produces a notice; registering one that returns `true` is allowed and is the correct choice only for routes that are genuinely public. The `args` schema validates and sanitises inputs before the handler sees them, so the handler can trust their types.

The *wp2shell* chain of July 2026 is the reason this book repeats the point. Its first half, as described in the public advisories, let a request reach a REST handler through the batch endpoint without the handler's authorisation being enforced. That was a core bug, fixed in 6.9.5 and 7.0.2, and plugin authors could not have prevented it. What plugin authors can do is make sure their own handlers fail closed: a permission callback that checks a specific capability, tests that call every route as an anonymous visitor and as a subscriber, and handlers that would still refuse to do damage if called by the wrong person.

## 5.4 Settings and storage

A plugin's data has a shape, and the shape suggests where it belongs. Settings — a handful of values the administrator changes rarely — belong in options, registered with the Settings API so that WordPress handles the form, the nonce and sanitisation. Records that look like content, with titles, authors and statuses, belong in a custom post type, which brings revisions, the admin list screen, REST endpoints and export for free. Records that do not look like content — a log of thousands of events queried by date and type — may justify a custom table, created with `dbDelta()` on activation, with a schema version stored in an option so that later releases can migrate it.

The choice also decides where data goes when the site moves. Options and posts travel with every export and migration tool; a custom table travels only if the tool copies the whole database. And it decides who can read the data: anything in the database is readable by every plugin on the site and by any SQL injection in any of them.

## 5.5 Blocks in 2026

The block editor represents content as a tree of blocks. A block is described by a `block.json` file declaring its name, attributes, supports and assets. A *static* block saves its HTML into the post content when the author saves; a *dynamic* block saves only its attributes and is rendered by PHP on every page view, through a render callback or a `render.php` file. Dynamic blocks suit content that changes — a summary of recent maintenance, for example — and keep rendering logic on the server, where escaping can be checked.

Until 2026, a block needed a JavaScript build to appear in the editor. WordPress 7.0 allows blocks to be registered entirely in PHP: authors can insert them in the editor and see a server-rendered preview. This lowers the cost of a simple dynamic block considerably for plugin developers who are not JavaScript developers, at the price of the richer editing experience a custom JavaScript interface provides. The Interactivity API, in core since 6.5, adds front-end behaviour to server-rendered blocks through HTML directives rather than a separate JavaScript application.

## 5.6 Abilities, the AI Client and MCP

The Abilities API gives a plugin a structured way to say "here is something this site can do": a name, a human-readable description, a JSON schema for input and output, a function that does the work, and a permission callback. The MCP Adapter plugin can expose registered abilities to external AI agents as tools. A plugin that registers an ability is therefore publishing an entry point that may be called by software acting on someone's behalf, with inputs chosen by a language model.

Treat an ability exactly like a REST route. The permission callback must check a specific capability for the user the agent is acting as. The input schema must be strict. The ability must be safe if called with hostile input, because the agent's instructions may have come from content an attacker wrote — a comment, a product review, an email. And any token that authenticates an agent to the site is a credential with administrator-level blast radius if the abilities behind it are powerful. In November 2025, CVE-2025-11749 in a popular AI plugin showed that last point concretely: an optional setting made the plugin's MCP bearer token visible through the site's REST API index, and anyone who read it could call tools that changed user accounts.

The AI Client runs in the other direction: a plugin builds a prompt and the configured provider answers. The provider credentials belong to the site owner and are stored on the site, so they become rows in the site's secrets inventory. Output from a model is input in the sense of Chapter 3: escape it before printing it, validate it before acting on it, and never pass it to a function that interprets code or SQL.

## 5.7 Distribution and the update channel

A plugin reaches sites through one of three channels. The **WordPress.org directory** hosts free plugins under GPL-compatible licences, reviews every new plugin by hand, and delivers updates to every site that has the plugin installed. **Premium plugins** are usually sold by their vendors and updated from the vendor's own server through a licence key. **Composer** delivers plugins to sites managed as Composer projects, through wpackagist (a mirror of the directory) or vendors' own repositories.

The directory's Detailed Plugin Guidelines prohibit, among other things, obfuscated code, tracking users without consent, loading executable code from external servers, and misleading users. Developers with commit access must use multi-factor authentication. Plugin Check, a plugin maintained by the review team, runs many of the automated checks that reviewers use, and running it before submission avoids the most common rejections.

Every channel is also a path an attacker can use, because whoever controls a plugin's update controls every site that installs it. Three 2026 incidents show three different routes. In April, WordPress.org closed an entire family of 31 plugins in one day after a backdoor, dormant for months, activated in their updates; reports disagree about whether the attacker hijacked the developer's account or bought the plugins outright and inherited their commit access. In June, a premium vendor's build and distribution pipeline was found to have been injecting malicious code into its own update packages for weeks. In July, a plugin with about 20,000 installations shipped a backdoor that let an attacker log in as an administrator, after an apparent developer-account compromise; it was detected within about two hours of release and the plugin was removed from download. By June 2026, WordPress.org was holding plugin updates for about 24 hours while an automated review scans them for malware, accepting a short delay for a chance to catch a poisoned update before it spreads.

At the same time, the number of plugins being submitted grew sharply — reported as roughly 500 a week in 2026 against about 150 a week in 2024, partly because AI tools have made it easy to produce a working plugin in an afternoon. The review queue peaked at around 1,050 plugins in April 2026 before the team cleared it. A plugin that passes review has been checked for policy and for obvious problems; it has not been audited.

## 5.8 Leaving cleanly

Deactivation should stop the plugin's scheduled events and leave its data, so that reactivating it restores the site's state. Uninstall should remove every option, table, transient, custom post type record, user meta key, scheduled event and file the plugin created — and nothing that belongs to the site's content or to other plugins. Plugins that never clean up leave autoloaded options and orphaned tables that slow sites for years after the plugin is forgotten; plugins that clean up too aggressively delete content the client still wanted. Write the uninstall routine from a list of everything the plugin creates, and test it on a copy.

### Review questions

1. Why does an AJAX handler registered with `wp_ajax_` need a capability check even though it is not registered with `nopriv`?
2. What do authentication, a capability check and a nonce each establish, and which one is a REST permission callback responsible for?
3. When would a custom table be a better home for plugin data than post meta, and what does it cost you?
4. Why should an ability exposed through the MCP Adapter be designed as if its input were written by an attacker?
5. Describe three different ways a malicious update reached WordPress sites in 2026. Which controls in your own process would have slowed each?

<a id="chapter-6"></a>
# Chapter 6: Conventions and Team Practice — Standards, Review, and the Tech Lead's Job

## 6.1 Two style traditions

A PHP developer who works on both WordPress and framework code writes in two dialects. The same function looks like this under the WordPress Coding Standards:

```php
<?php
// WordPress Coding Standards: tabs, spaces inside parentheses,
// snake_case functions with a prefix, Yoda conditions.
function example_log_is_recent( array $entry ): bool {
	if ( empty( $entry['created_at'] ) ) {
		return false;
	}
	return strtotime( $entry['created_at'] ) >= strtotime( '-30 days' );
}
```

and like this under PSR-12 or PER Coding Style:

```php
<?php
// PER Coding Style: four spaces, no inner spaces, camelCase methods,
// braces for functions on their own line.
final class EntryAge
{
    public function isRecent(Entry $entry, DateTimeImmutable $now): bool
    {
        return $entry->createdAt >= $now->modify('-30 days');
    }
}
```

The WordPress standards also require the long `array()` syntax, "Yoda" comparisons (`if ( 'publish' === $status )`) so that a mistyped `=` fails instead of assigning, and specific naming for hooks and files. More importantly, the WordPress PHP_CodeSniffer ruleset does not stop at style: it flags unescaped output, missing nonce verification, unprepared SQL, direct database queries without caching, and use of functions WordPress provides safer alternatives for. That makes it a security tool as well as a formatter.

A practical team rule: code that runs inside WordPress — plugins and themes — follows the WordPress standards, because reviewers, Plugin Check and other WordPress developers expect it. Code that does not depend on WordPress — a command-line tool, a library — follows PER, uses `strict_types` and namespaces, and is analysed at a high PHPStan level. A plugin can contain both: a thin WordPress layer in WordPress style that calls a namespaced, framework-independent core.

## 6.2 What belongs in Git

A WordPress site is a mixture of code you wrote, code someone else wrote and data. Committing all of it to one repository makes updates impossible to review; committing none of it makes deployments impossible to reproduce.

The common answer is to commit only your own code — custom plugins, a child theme, must-use plugins — and to describe everything else as dependencies. Roots' Bedrock project popularised a structure in which WordPress core and plugins are Composer dependencies, installed from wpackagist or vendor repositories into a `web/` directory, with configuration read from environment variables and the uploads directory excluded from version control. The site's exact versions then live in `composer.lock`, an update is a reviewable pull request that changes the lock file, and a deploy installs exactly what was tested.

Not every client site can or should be converted. Many are managed through the admin's update screens on shared hosting, and the practice has to work for those too. What matters is that for each site someone can answer "what exactly is running, and how did it get there?"

## 6.3 Local environments

A developer needs a disposable WordPress that matches production closely enough to trust. The common choices in 2026 are `wp-env` (a WordPress-maintained command that runs WordPress in Docker, used widely for plugin development and CI), DDEV and Lando (general Docker-based environments with WordPress recipes), Local (a desktop application), WordPress Studio (a desktop application from WordPress.com) and WordPress Playground (WordPress compiled to WebAssembly, running entirely in a browser or Node.js, useful for demos, tests and quick experiments). Match the PHP version and the major plugins to production; most "works on my machine" problems in WordPress are version mismatches.

## 6.4 Continuous integration

A pull request to a plugin should run, at minimum:

- **PHP_CodeSniffer** with the WordPress standard (and PHPCompatibility for the PHP versions you support).
- **PHPStan** with WordPress stubs, at the highest level the codebase can sustain, with a shrinking baseline.
- **Plugin Check** against a disposable WordPress started in the pipeline.
- **Tests**: unit tests for logic that does not need WordPress, and integration tests that boot WordPress for permission callbacks, storage and uninstall.
- **Secret scanning** over the changes (Chapter 8).
- **Dependency audit**: `composer audit` and, if the plugin has a JavaScript build, the equivalent for its packages.

Pin the PHP version, the WordPress version and the tool versions in the pipeline, and print them as the first step. A matrix across the oldest and newest PHP versions the plugin claims to support catches most compatibility mistakes.

## 6.5 Review that tools cannot do

Tools catch missing escaping and unprepared SQL. They do not catch a permission callback that checks the wrong capability, an ability that does more than its description says, a migration that will lock a large table, an uninstall routine that deletes content, or a feature the client did not ask for. A useful review asks, for each change: which entry points does this add or modify, and who can reach each one? What does it store, where, and who can read it? What happens on activation, update, deactivation and uninstall? What happens if it is called twice, or concurrently, or with no current user?

Write those questions into the pull-request template, so that the author answers them before the reviewer has to ask.

## 6.6 AI-assisted code on a team

By 2026 most teams use AI coding assistants, and WordPress has adjusted. In February 2026, WordPress published guidelines for AI-assisted contributions to core that do not ban the tools but require contributors to disclose AI involvement in pull requests and to take full responsibility for the work. The WordPress.org plugin team has said there is no rule against generated code and that developers remain responsible for what they host.

The data gives reasons for caution. GitGuardian's 2026 report found that commits co-authored by an AI coding assistant leaked secrets at roughly twice the rate of the baseline — about 3.2% against 1.5% — though commentators have argued that the difference reflects human decisions about what to commit as much as the tools themselves. Patchstack's 2026 report called out "vibe coding", shipping generated plugin code that its author cannot fully audit, as a growing source of vulnerabilities.

A team policy that has worked for many groups is short:

1. **Disclose.** The pull request says which parts were generated or substantially assisted.
2. **Own it.** The author can explain every line, and the reviewer reviews generated code exactly as strictly as handwritten code.
3. **Tests are not review.** Generated tests that pass generated code prove consistency, not correctness. A human writes or checks the tests for permissions and data handling.
4. **No client data or secrets in prompts.** Use synthetic data; treat assistant transcripts and configuration files as places secrets can leak.
5. **Agents get least privilege.** An agent that can run commands on a developer's machine can read everything that developer can read. Keep client credentials out of reach of tools that do not need them.

## 6.7 Decisions on record

Teams forget why things are the way they are. A short *architecture decision record* — the decision, the options considered, the forcing question, and the consequences accepted — written when a significant choice is made saves hours of re-argument later. For a WordPress practice, the decisions worth recording include where each class of secret lives, the update policy for each kind of component, the minimum PHP and WordPress versions each plugin supports, and which coding standards apply where. The Gauntlet's decision maps are practice for exactly this habit.

### Review questions

1. Why might a team follow the WordPress Coding Standards in a plugin and PER Coding Style in a command-line tool in the same repository?
2. What does a Composer-managed WordPress site make reviewable that an admin-updated site does not?
3. Name three things a reviewer must check that PHPCS and PHPStan cannot.
4. What does WordPress's February 2026 guidance ask of contributors who use AI tools, and why is "tests pass" not enough for generated code?
5. Which decisions in a WordPress practice deserve a written record, and why?

<a id="chapter-7"></a>
# Chapter 7: Security in the WordPress Ecosystem — Classes, Cases, and AI on Both Sides

## 7.1 Where vulnerabilities live

WordPress core is small relative to its ecosystem and heavily reviewed. Plugins are numerous, uneven in quality and often maintained by one person. The vulnerability data reflects that. Patchstack's report on 2025, published in early 2026, counted 11,334 new vulnerabilities in the WordPress ecosystem, an increase of about 42% over 2024; the large majority — reported as more than nine in ten — were in plugins, with only a couple in core. The report also found that highly exploitable vulnerabilities had more than doubled, and that the most heavily targeted vulnerabilities reached mass exploitation a median of about five hours after disclosure.

Those figures change how a maintainer should think. Core updates matter, but the realistic risk on a typical site is the long tail of plugins, especially abandoned ones. A site with forty plugins has forty codebases' worth of entry points, each running with full privileges. And the window between a patch being published and attackers using the vulnerability is now shorter than a working day.

## 7.2 The classes that recur

Most WordPress plugin advisories fall into a small number of classes, and each maps to a mechanism from earlier chapters.

| Class | Typical shape in a plugin | Mechanism |
| --- | --- | --- |
| Broken access control | An AJAX or REST handler with no capability check, or the wrong one | Chapter 5.2–5.3 |
| Cross-site request forgery | A state-changing handler without nonce verification | Chapter 5.3 |
| Cross-site scripting | Stored values or shortcode attributes printed without escaping | Chapter 3.2–3.3 |
| SQL injection | A variable concatenated into SQL instead of prepared | Chapter 3.4 |
| PHP object injection | `unserialize()` on data an attacker can influence | Chapter 3.5 |
| Arbitrary file upload or write | A handler that writes a user-named file to an executable directory | Chapter 3.6 |
| Privilege escalation | A profile or settings handler that lets a user change their own role or capabilities | Chapters 4.3, 5.3 |
| Server-side request forgery | A "fetch this URL" feature without destination checks | Chapter 3.7 |
| Sensitive data exposure | Tokens or keys returned by an endpoint or written to a public file | Chapter 8 |

Severity depends on who can reach the entry point. The same missing check is moderate if only administrators can reach it, serious if any subscriber can, and critical if an anonymous visitor can. That is why advisories say "unauthenticated" or "authenticated (subscriber+)" so prominently, and why the first question in any review is who can reach the code.

## 7.3 Case: wp2shell (July 2026)

In July 2026 two vulnerabilities in WordPress core were disclosed and patched together under the name *wp2shell*. As described in public advisories, CVE-2026-63030 was a route confusion in the REST API's batch endpoint that let a request reach a handler without its authorisation being enforced, and CVE-2026-60137 was a SQL injection; chained, they gave an unauthenticated attacker remote code execution. The full chain affected WordPress 6.9.0 through 6.9.4 and 7.0.0 through 7.0.1, and was fixed in 6.9.5 and 7.0.2. The researchers at Searchlight Cyber who found it said an OpenAI model helped them find the vulnerabilities and develop the chain in about ten hours.

A working proof of concept was published, and within about two days of the patch, security firms reported mass scanning and exploitation from multiple actors, including deployment of persistent web shells; one firm noted that `207 Multi-Status` responses from the batch endpoint were a strong indicator of exploitation attempts. Sites on WordPress's automatic minor updates received the fix quickly. Sites with automatic updates disabled, or stuck on older branches for compatibility, depended on someone noticing.

Three lessons generalise. Authorisation must be enforced where the action happens, not only where the request enters. A SQL injection anywhere can become code execution when the database holds serialised data, user roles and plugin settings. And because the chain only existed from 6.9 onward, the exposed population was the *recently updated* sites — a reminder that patch policy is about speed in both directions.

## 7.4 Case: PHP2Shell (October 2026)

On 21 October 2026, the PHP project released 8.5.12, 8.4.27, 8.3.36 and 8.2.35 to fix two critical vulnerabilities in the PHP engine itself, nicknamed *PHP2Shell*. The PHP project described CVE-2026-109618 as remote code execution through memory corruption when PHP runs out of memory while setting up request data and then treats the partly initialised data as valid during cleanup, and CVE-2026-109619 as remote code execution through request-owned global state that a later request on the same worker could reach before normal initialisation reset it. Every PHP version from 5.4 through 8.5.11 was reported as affected. Branches 7.4, 8.0 and 8.1 received no official fix.

The bugs were reachable without authentication and independent of the application: researchers demonstrated working attacks against Apache servers running `mod_php` with default settings, independent of any application code. Disabling `session.upload_progress.enabled` was reported to block one of the two paths but not the other; patching was the only complete fix. The disclosure embargo was broken, CISA urged organisations to patch immediately, and several teams — including researchers using OpenAI and Google models, and others who found the same flaws independently — reported that AI tools had helped them find or verify the vulnerabilities.

For a WordPress maintainer, PHP2Shell is a lesson about ownership. A site with every plugin and core update applied was still exposed, because the vulnerable component was the runtime. Who updates PHP on each site — you, the host, or the client's IT department — is a question that must have a written answer before a day like 21 October. And for sites on 7.4–8.1, the honest options were a distribution or vendor backport, an urgent upgrade, or accepting a known critical risk in writing.

It is also a lesson about mechanisms. Section 0.2 described shared-nothing as a promise the engine keeps by resetting state between requests. CVE-2026-109619, as described, was a failure of exactly that reset. The guarantees you build on are only as strong as the code that implements them, and that code is now being read by tools that do not get tired.

## 7.5 Case: the 2026 supply-chain incidents

Section 5.7 described three plugin incidents from 2026: a family of 31 plugins with a dormant backdoor, closed in one day in April; a premium vendor's compromised build pipeline in June; and a backdoored plugin of about 20,000 installations in July, removed within hours. Add the PHP package side: in May 2026, attackers rewrote existing Git tags on the `laravel-lang` packages so that trusted version numbers delivered a file, loaded automatically by Composer, that harvested cloud credentials, Kubernetes and Vault tokens, Git credentials, SSH keys and CI secrets.

These incidents share a structure. None required a vulnerability on the victim's site. Each used a channel the victim trusted precisely so that it would not have to be reviewed: automatic plugin updates, a vendor's update server, a version tag. And in each case the fastest adopters were the first victims. Defences come in layers — a delay before installing non-security updates, preferring updates with a public changelog, watching for unexpected new files and administrators after updates, lock files that pin commits, and vendors protecting their own accounts and pipelines with multi-factor authentication and signed releases. None is complete. A maintainer's policy has to balance the risk of installing a poisoned update quickly against the risk of leaving a known vulnerability open slowly, and the two risks pull in opposite directions.

## 7.6 AI on both sides

The incidents above share another feature: AI appears in almost all of them. The picture in late 2026 is uneven, contested and moving quickly, so it is worth being precise about what has been reported.

On discovery, in May 2026, researchers presenting at Ekoparty Miami described an AI pipeline that surfaced more than 300 critical vulnerabilities in WordPress plugins in about 72 hours, at a model cost of roughly $20 per finding; the human bottleneck was verification, at 30–60 minutes each. In April 2026 Anthropic announced Project Glasswing, giving a restricted set of organisations access to an unreleased model, Claude Mythos Preview, to find vulnerabilities in critical software; by 2 October 2026 its coordinated-disclosure dashboard listed more than 6,000 findings and several hundred advisories and CVEs, including a critical code-injection flaw in the PHP template engine Twig. wp2shell and PHP2Shell were both found with AI assistance.

On attack, the same capabilities shorten the time from patch to exploit, because comparing a patched release with the previous one and writing an exploit is exactly the kind of task these tools accelerate. Patchstack's 2026 report described attackers increasingly equipped with AI that can find and exploit vulnerabilities autonomously. Not everyone agrees on how far this has gone: a July 2026 VulnCheck report argued that AI-assisted vulnerability discovery had been overhyped. A sensible position for a practitioner is that the cost of finding a bug in a small plugin has fallen sharply, whether or not every claim about autonomous attackers is true.

On defence, the same tools are being used to review code, triage reports and scan update packages — the WordPress.org update hold, for example, exists to run an automated malware review. And on the development side, AI tools are a new source of risk: generated plugins their authors cannot audit, secrets committed in AI-assisted commits, credentials in MCP configuration files, and, in the August 2025 *s1ngularity* compromise of the Nx build tool, malicious package versions that instructed AI command-line tools on developers' machines to search for secrets.

The practical conclusion is not that WordPress is doomed or that AI will save it. It is that the slow parts of the defender's process — noticing an advisory, deciding, testing, deploying, rotating — now determine outcomes, and they are the parts a small practice can actually improve.

## 7.7 Hardening that matters

Hardening advice for WordPress is abundant and uneven. The measures with the best return for a small practice are:

- **Fewer plugins, maintained ones.** Every plugin is an attack surface. Remove what is unused; replace what is abandoned.
- **Least privilege for people.** Few administrators, each with their own account, multi-factor authentication, and no shared logins. Remove accounts when people leave.
- **No code editing from the admin.** `DISALLOW_FILE_EDIT` removes the theme and plugin editors; `DISALLOW_FILE_MODS` also blocks installing and updating from the admin, which suits sites deployed through version control and does not suit sites updated through the dashboard.
- **File permissions that match the deployment.** The PHP user should not be able to write to core or plugin directories on a site deployed by Composer.
- **A web application firewall and virtual patching**, from the host or a security plugin, to block exploitation of known vulnerabilities in the hours before you can update.
- **Integrity checks.** `wp core verify-checksums` and `wp plugin verify-checksums --all` compare installed files with WordPress.org's published checksums. They cannot see files that should not exist, such as a new must-use plugin or a PHP file in `uploads`, so a file-change baseline complements them.
- **Logs and alerts** for logins, new administrators, plugin installations and file changes, stored where an intruder on the site cannot erase them.
- **Backups that have been restored.** A backup is a hypothesis until a restore has been tested.
- **A patch policy and an owner for every layer** — core, plugins, themes, PHP, the web server and the operating system.

### Review questions

1. Why is the severity of a missing capability check determined mainly by who can reach the entry point?
2. Describe the wp2shell chain as a sequence of events. Which half could a plugin author have made the same mistake in?
3. Why would a fully updated WordPress site still have been exposed to PHP2Shell, and whose job was it to fix that?
4. What do the 2026 supply-chain incidents have in common, and why do they make "always update immediately" incomplete?
5. Which parts of a defender's process does cheaper vulnerability discovery make more important, and why?

<a id="chapter-8"></a>
# Chapter 8: Secrets — Inventory, Blast Radius, and Rotation

## 8.1 What counts as a secret on a WordPress site

A secret is any value that grants access or proves identity to whoever holds it. A typical client site holds more of them than its owner realises:

- the **database credentials** in `wp-config.php`;
- eight **authentication keys and salts** in `wp-config.php`, which WordPress uses to sign login cookies and nonces;
- **application passwords** for API clients, stored hashed in user meta;
- **SMTP** or transactional email API keys, usually in a plugin's options;
- **payment gateway** keys, for sites that take payments;
- **AI provider keys**, increasingly common since WordPress 7.0's AI Client;
- **licence keys** for premium plugins, which often authorise downloads of updates;
- **OAuth client secrets** and tokens for social login, analytics and marketing integrations;
- **MCP or agent tokens**, if the site exposes abilities to AI agents;
- and, outside the site, the hosting panel, SFTP or SSH credentials, the registrar account, deploy keys, CI secrets and backup storage credentials.

Every one of these is someone's job to know about. The first control is an inventory.

## 8.2 Blast radius

A secret's *blast radius* is what an attacker can do with it, combined with who and what can read it. The two halves are independent. A database password unlocks everything on the site, and in `wp-config.php` it is readable by every PHP file the server runs — every plugin, and every plugin's vulnerability that can read files. An SMTP key unlocks less, but stored as an autoloaded option it is also in every database backup, every staging copy, every migration export, and every SQL injection's reach.

Thinking in blast radius changes what "securing a secret" means. Moving a key from one file to another accomplishes nothing if the same processes can read both. Shrinking the set of readers — a file outside the web root readable only by one pool's user, a host-level secret store, a scoped key that can only send email from one domain — reduces the radius. So does reducing what the secret unlocks: a provider key restricted to one site, with a spending cap, is less dangerous than an agency-wide key with no limits, even if both leak the same way.

## 8.3 How secrets leak

Secrets leak through a small number of routes, and most are boring.

**Files the web server serves.** An editor leaves `wp-config.php.bak` or `wp-config.php.swp` next to the original; because those names do not end in `.php`, the server sends them as text. A `.env` file in the document root is served the same way. In 2024, researchers described an extortion campaign that scanned more than 100,000 domains for exposed `.env` files and used the cloud credentials it found in them.

**Version control.** A secret committed once remains in history after it is deleted; anyone with a clone has it. An exposed `.git` directory on a web server lets anyone reconstruct the repository.

**Diagnostics.** A `phpinfo()` page shows environment variables. WordPress writes `debug.log` to `wp-content/` by default when `WP_DEBUG_LOG` is `true`, and that directory is usually web-accessible. Error pages and stack traces can include configuration values.

**APIs.** An endpoint that returns a settings object can return the keys inside it. The CVE-2025-11749 case in Chapter 5 was a token exposed through the REST API index.

**Copies.** Backups, staging sites, database exports sent to a developer, support tickets, chat messages, screenshots — and, now, prompts and transcripts in AI tools, and configuration files for MCP servers.

**Development machines.** A developer's laptop holds SSH keys, deploy tokens and `.env` files for every client. Any process running as that user can read them — including a malicious package installed as a dependency, a compromised editor extension, or an AI agent following instructions it should not have followed.

## 8.4 The cases

The years 2025 and 2026 supplied examples of each route.

**GitGuardian's 2026 report** counted about 29 million new hardcoded secrets in public GitHub commits during 2025, up about 34%. Credentials for AI services were the fastest-growing category, with about 1.28 million leaked, up about 81%. Commits co-authored by AI coding assistants leaked secrets at roughly twice the baseline rate, and the report found tens of thousands of secrets in MCP configuration files.

**Laravel `APP_KEY` (July 2025).** Research by GitGuardian and Synacktiv found more than 260,000 Laravel application keys exposed on GitHub and hundreds of live applications vulnerable to remote code execution because of them (Chapter 3.5). The remedy was rotation: a new key, deployed everywhere, with sessions and encrypted values re-issued.

**The *s1ngularity* compromise (August 2025).** Malicious versions of the Nx JavaScript build tool, installed by ordinary dependency updates, used AI command-line tools already present on developers' machines to search for credentials and wallet files, then published what they found. It was a JavaScript incident, and it is in this book because PHP developers use the same machines, the same AI tools and the same JavaScript build chains for their themes and blocks.

**AI Engine (November 2025).** A WordPress AI plugin's "No-Auth URL" option for its MCP integration exposed the bearer token that authorised MCP calls through the site's REST API, letting an unauthenticated visitor use tools that could change user accounts. Fixed in version 3.1.4; sites that had used the option needed to rotate the token as well as update.

**`laravel-lang` (May 2026).** Rewritten Git tags delivered a credential stealer through Composer's autoloader, targeting cloud credentials, Kubernetes and Vault tokens, Git credentials, SSH keys and CI secrets — the secrets of the *developer and the pipeline*, not the application.

The common thread is that the leak itself was rarely sophisticated. What determined the damage was whether the secret's owner knew it existed, how much it unlocked, and how quickly it could be made useless.

## 8.5 Storing secrets for WordPress

WordPress reads its configuration from `wp-config.php`, which is PHP. That gives you choices about where the values actually come from. WordPress will also look for `wp-config.php` one directory above the WordPress root, which keeps the file out of the document root on many layouts. A common pattern loads secrets from a file outside the document root and refuses to start without them:

```php
<?php
// Fragment from wp-config.php. The secrets file lives outside the document
// root and is readable only by the PHP-FPM pool's user.
$example_secrets_file = dirname( __DIR__ ) . '/private/wp-secrets.php';

if ( ! is_readable( $example_secrets_file ) ) {
	http_response_code( 500 );
	exit( 'Site configuration is incomplete.' );
}

$example_secrets = require $example_secrets_file; // Returns an array.

define( 'DB_PASSWORD', $example_secrets['db_password'] );
define( 'AUTH_KEY', $example_secrets['auth_key'] );
// …the remaining keys and salts…

unset( $example_secrets, $example_secrets_file );
```

Environment variables are the other common source, and Bedrock-style projects use them throughout. They come with a trap: PHP-FPM clears the environment of its workers by default (`clear_env = yes`), so a variable set in your shell is visible to WP-CLI but not to the website unless the pool configuration passes it through. Decide on one source that every process reads, and document it.

Wherever secrets are stored, the same rules apply. Nothing secret lives in a file the web server will serve. Nothing secret is committed. Debug logs are written outside the document root (`WP_DEBUG_LOG` accepts a path). And plugin secrets that must live in the database are stored in options that are not autoloaded and never returned by any endpoint.

## 8.6 Rotation

Rotation replaces a secret with a new one and makes the old one stop working. It is the only remedy for a leak: deleting the leaked copy does nothing about the copies already made. A secret you have never rotated is one you cannot rotate quickly, because you have not discovered what depends on it.

Each kind of secret rotates differently:

| Secret | How to rotate | What breaks |
| --- | --- | --- |
| Keys and salts | Replace all eight values (`wp config shuffle-salts` does this) | Every user is logged out; outstanding nonces become invalid |
| Database password | Change it in the database server and in the configuration together | The site is down between the two changes unless you overlap users |
| Application password | Revoke the old one in the user's profile, create a new one, update the client | Only the client using it |
| Third-party API key | Create a new key, deploy it, verify, then revoke the old one | Nothing, if you overlap; requests fail if you revoke first |
| AI provider key | As above, and set or confirm spending limits on the new key | As above |
| Licence key | Through the vendor; update the site's licence setting | Update downloads until updated |

Time each one on a test site and write the times down. The numbers become part of your incident plan and, as Chapter 10 discusses, part of your prices.

## 8.7 AI provider keys

AI provider keys deserve their own section because they combine a high leak rate with a direct cost. A leaked database password is dangerous; a leaked AI key is dangerous *and* bills someone for every request an attacker makes. Questions to settle for every site using the AI Client: whose account the key belongs to (the client's, ideally); whether it is restricted to the models and features the site uses; what spending limit and alerts are set at the provider; where it is stored on the site and which plugins can read it; and who is notified when usage spikes. A single agency key pasted into every client site is convenient until it leaks, at which point every site's AI features stop together and the agency pays the bill.

### Review questions

1. List the secrets on a WordPress site you know well. For each, who and what can read it?
2. Why does moving a secret from `wp-config.php` into an environment variable not necessarily reduce its blast radius?
3. Which leak routes in Section 8.3 involve no vulnerability in the site at all?
4. What breaks when you rotate WordPress's salts, and who should be told beforehand?
5. Why are AI provider keys more urgent to rotate than many other API keys?

<a id="chapter-9"></a>
# Chapter 9: Production WordPress — Capacity, Caching, Backups, and Updates

## 9.1 Hosting models

Client sites live on four broad kinds of hosting. **Shared hosting** puts many sites on one server with a control panel; it is cheap, and the client has little control over PHP versions or server configuration. **Managed WordPress hosting** adds WordPress-specific caching, backups, staging and often automatic updates and a firewall, and usually restricts some plugins and server access. **A virtual server** gives full control and full responsibility, including the operating system and PHP. **Containers or platforms** run WordPress in Docker or on a platform service, typically with Composer-managed code and external storage for uploads.

The choice decides who owns each layer of patching and recovery. On shared and managed hosting, the host updates PHP and the server, on its own schedule. On a virtual server, you do. PHP2Shell made this concrete: on 21 October 2026, the question "is this site patched?" had a different owner on each kind of hosting.

## 9.2 PHP-FPM capacity is a memory budget

A PHP-FPM pool handles requests with a fixed maximum number of worker processes, `pm.max_children`. Each worker serves one request at a time. If every worker is busy, new requests wait in a queue; if the queue fills, the server returns errors. The maximum is set by memory, not CPU:

```
pm.max_children ≈ (memory available to PHP) ÷ (typical memory per worker)

example: a 4 GB server, 1 GB reserved for the database, the web server and
the operating system, workers averaging 80 MB:

  3,072 MB ÷ 80 MB ≈ 38 workers
```

Measure the per-worker figure from the running site rather than guessing, and size for the heavy requests (admin pages, imports, WooCommerce checkouts), not the average. Too many workers and the server swaps or the out-of-memory killer ends processes; too few and requests queue while memory sits idle. A page cache changes the arithmetic entirely, because cached pages never reach PHP.

## 9.3 Caching for real sites

Section 4.5 described the three caching layers. In production, the usual arrangement is a page cache in front (from the host, a reverse proxy or a CDN) for anonymous visitors; a persistent object cache (Redis or Memcached) for logged-in users and the admin; and OPcache always enabled. The page cache must not cache responses that depend on a logged-in user, a cart or a form token. WooCommerce and membership sites need careful exclusions, and a mistake can show one customer another customer's details.

## 9.4 Real cron and background work

Disable WP-Cron's page-load trigger on production sites and run due events from the system scheduler (Section 4.6). Long-running work — imports, image processing, email campaigns — should be broken into small jobs; the Action Scheduler library, used by WooCommerce and many plugins, provides a queue on top of WordPress for this.

## 9.5 Logs and observability

Production sites should log PHP errors to a file outside the document root, never display them, and rotate the log. Useful signals for a small practice: PHP fatal errors and warnings per day, slow requests, login failures, new administrator accounts, plugin and theme installations and updates, file changes outside expected deployments, and the `207 Multi-Status` or other unusual responses that an advisory names as an indicator. Locally, Query Monitor shows queries, hooks and HTTP calls per page. In production, application performance monitoring tools and OpenTelemetry-based tracing can do the same at a cost.

## 9.6 Backups are only real when restored

A backup strategy states what is copied (database, uploads, and code if it is not in version control), how often, where copies are kept (at least one off the server and off the hosting account), how long they are retained, and who can delete them. It also states how a restore is done and how long it takes, and that statement is only true if someone has done it recently. A backup taken after a compromise contains the compromise; retention must reach back further than the time it typically takes to discover one. Backups also contain every secret on the site, so their storage credentials and access belong in the secrets inventory.

## 9.7 Update policy

An update policy decides, for each kind of component, how quickly updates are applied and by what route. A reasonable starting point in 2026:

| Component | Default | Override |
| --- | --- | --- |
| Core security and minor releases | Automatic | None needed |
| Core major releases | After testing on staging, within weeks | Sooner if a security fix only ships in the major |
| Plugins from WordPress.org | Automatic or batched daily, after a short delay | Immediately if a vulnerability is known to be exploited |
| Premium plugins | Batched, after a delay and changelog check | Immediately for an exploited vulnerability |
| Themes | Batched with plugins | As above |
| PHP | Planned upgrades by minor version; security releases promptly | Immediately for critical engine vulnerabilities, by whoever owns PHP on that hosting |

The delay exists because of the supply-chain incidents in Chapter 7; the override exists because of the five-hour median to mass exploitation. Each site's policy should say who owns each row and how the owner hears about a vulnerability: a vulnerability feed matched against an inventory, a host's notifications, or a security plugin's alerts.

Whatever route an update takes, it should be verified: the site's key pages render with expected content, logins and forms work, the error log has not grown, and checksums still verify. "The page returned 200" is not a test.

## 9.8 Incident response for small sites

When a site is compromised, the order of work matters more than speed in any single step:

1. **Contain.** Take the site offline or put it behind a maintenance page if it is harming visitors; block the attacker's access if you can identify it.
2. **Preserve.** Copy the current files, database and logs before changing anything. You will need them to find the entry point.
3. **Find the way in.** A vulnerable plugin, a stolen password, a poisoned update, a compromised host account. Without this, restoring is a scheduled reinfection.
4. **Restore** from a backup taken before the earliest sign of compromise, or rebuild from known-good sources.
5. **Close the way in** — update, remove or replace the vulnerable component.
6. **Rotate** every secret on the site's inventory, starting with those an attacker with code execution could have read.
7. **Verify** with checksums, a file comparison against a baseline, the administrator list and the logs.
8. **Tell the client** what happened, what was affected, what was done and what changes now. If personal data may have been exposed, they may have legal obligations with deadlines.

Rehearse this on a disposable copy of a site, with inert markers you plant yourself. The first time you run it should not be the day it is needed.

### Review questions

1. On which kinds of hosting did you, rather than the host, need to act on PHP2Shell?
2. How would you calculate `pm.max_children` for a server, and what changes when a page cache is added?
3. Why must backup retention reach further back than the time it takes to detect a compromise?
4. Why does the update policy include both a delay and an override?
5. Why does "find the way in" come before "restore" in incident response?

<a id="chapter-10"></a>
# Chapter 10: The Industry, the Freelancer, and the Tech Lead — Market, Governance, Money, and Law

## 10.1 The market in 2026

WordPress ran roughly 40% of all websites in October 2026, according to W3Techs, down from a peak of about 43.6% in mid-2025, and close to 60% of sites using a recognisable content management system. The decline is slow and comes from several directions at once: hosted builders such as Wix, Squarespace and Shopify for small businesses; headless and static architectures for developer-led teams; and JavaScript frameworks for applications. None of that changes the size of the installed base, which is what most PHP and WordPress work is about.

The work itself has shifted. Fewer clients need a site built from nothing; more need an existing site rescued, sped up, made accessible, secured, migrated or maintained. WooCommerce stores, membership sites and sites with complex editorial workflows pay better than brochure sites because they break in more expensive ways. And the security pressure described in Chapter 7 has turned maintenance from an upsell into the core of the relationship.

## 10.2 Governance and the WP Engine dispute

WordPress is open-source software developed by a community of contributors, with the WordPress.org infrastructure — the plugin and theme directories, the update servers — controlled by Matt Mullenweg, who also leads Automattic, the largest company in the ecosystem. That arrangement became contentious in September 2024, when Mullenweg publicly attacked WP Engine, a large managed WordPress host, over its contributions and its use of the WordPress trademark. WordPress.org blocked WP Engine's access to its servers, took over the Advanced Custom Fields plugin listing — which WP Engine owned — and republished it as Secure Custom Fields, and the companies sued each other. A court ordered WordPress.org access restored in December 2024. As of late 2026 the litigation continues, with WP Engine's amended complaints alleging plans to seek trademark royalties from other hosts and a jury trial reported as scheduled for June 2027.

For a practitioner, the dispute matters less for who is right than for what it revealed: one organisation's infrastructure is a single point of control for updates to hundreds of millions of sites. In June 2025, the Linux Foundation launched the FAIR package manager, a federated, vendor-neutral system for distributing WordPress plugins and themes, initially mirroring WordPress.org. Whether it becomes widely used is open. The lesson for a maintenance practice is the same as the supply-chain lesson in Chapter 7: know where each site's code comes from, and do not assume any channel is beyond question.

## 10.3 The freelance business: scope and price

A WordPress project is sold once and lived for years. The scope of the build should say what is included, what is not, how changes are requested and priced, and when the project ends. The relationship after launch should be a separate agreement — a *care plan* or maintenance retainer — that states what is done every month (updates under a written policy, backups and restore tests, monitoring, secret rotation drills, a monthly report), what response times apply to which severities, how many hours of other work are included, and what is billed beyond them.

Price maintenance from measurement. Time the routine work on real sites: an update cycle with verification, a restore test, a rotation drill, a monthly report. Multiply by sites and frequency. Add a margin for the business and a separate risk allowance for months like July or October 2026, when a core or engine vulnerability demands same-day work on every site at once. Then state a ceiling: the number of hours of incident work the plan covers before additional work is billed. A price set from a quiet month fails in a bad one; a price with no ceiling turns the bad month into unpaid work.

## 10.4 Ownership, access and handover

The client should own every account the site depends on: the domain registrar, the hosting, the DNS provider, premium plugin licences, email and payment services, analytics, and backup storage. The developer receives delegated access — a team-member login, a separate SFTP user, an administrator account in their own name — that can be revoked without changing anything else. This protects the client if the developer disappears, and protects the developer from responsibility for accounts they should never have held.

Licensing has a WordPress-specific wrinkle. WordPress is licensed under the GPL, and plugins and themes that run with it are generally distributed under GPL-compatible licences, so the code of a premium plugin may be legally redistributable. What vendors sell is updates, support and convenience, delivered against a licence key. A premium licence bought in the developer's name and used on a client's site ties the site's security updates to the developer's account. Buy licences in the client's name, or transfer them at handover.

A handover pack lets a client, or the next developer, continue without you: the inventory of what runs and where it came from, the secrets inventory (referencing where each secret is kept, never containing the secrets), the update policy, backup locations and restore instructions, runbooks for the common incidents, and a list of every account with its owner. Writing it is also the best audit of whether the site is maintainable.

## 10.5 Law that now applies

Three areas of law commonly reach WordPress work, and none of this section is legal advice.

**The EU Cyber Resilience Act** (Regulation (EU) 2024/2847) sets security requirements for products with digital elements placed on the EU market. Since 11 September 2026, manufacturers must report actively exploited vulnerabilities and severe incidents affecting their products to the designated authorities on short deadlines; the main obligations — secure development, vulnerability handling, documentation — apply from 11 December 2027. Free and open-source software developed outside a commercial activity is largely outside the main obligations, and organisations that systematically support open-source projects have a lighter "steward" regime. Software that is sold or monetised is different: a developer who sells a premium plugin to EU customers may be a manufacturer under the Act. Building a site for a client is generally a service rather than placing a product on the market, but the line deserves professional advice if your business depends on it. Penalties for breaching reporting obligations can reach €15 million or 2.5% of worldwide turnover.

**The European Accessibility Act** has applied since 28 June 2025 to many products and services offered to consumers in the EU, including e-commerce. Very small service businesses are exempt, but many clients are not. WCAG 2.2 at level AA is the practical technical standard. An accessibility audit, a remediation plan and an accessibility statement are now regular parts of client work.

**Data protection law** such as the GDPR applies whenever a site processes personal data, which is nearly always. When a developer or agency can access a client's personal data — user accounts, orders, form submissions — the client is usually the controller and the developer a processor, which typically calls for a data processing agreement. Breach notification deadlines can apply to the client after an incident, which is one reason the incident runbook ends with telling the client promptly.

## 10.6 The tech lead's year

A tech lead in a small WordPress practice spends less time writing features than deciding how features are written, reviewed, deployed and maintained. A useful annual rhythm: review every site's inventory, update policy and ownership of each layer; rehearse an incident and a restore; rotate long-lived secrets; check PHP support dates and plan upgrades before end-of-life rather than after; review the conventions repository and the CI pipeline; read the year's major advisories and ask, for each, what the practice would have done; and revisit care-plan prices against measured time. Between those, the job is code review against the questions in Chapter 6, mentoring on the mechanisms in this book, and saying no to plugins, features and shortcuts that would make sites harder to keep.

The AI tools that changed vulnerability discovery have also changed this job. A tech lead in 2026 reviews more code, more of it generated, against a faster clock. The response is not to ban the tools but to make the slow parts of the process — review, testing, patch deployment, rotation, telling the client — fast, routine and measured.

## 10.7 A practical project that brings the concepts together

Build a small maintenance practice in stages, making one additional guarantee explicit at each stage. These stages are the modules of *The Gauntlet VII*:

1. **Know what runs (M78).** A command-line tool, in strictly typed PHP, that inventories a WordPress site without executing any of its files. State what the inventory promises and how versions are compared.
2. **Record the work (M79).** A plugin that logs maintenance and shows the client a summary, with every entry point checked at the handler and passing the review tools. State who can reach each entry point.
3. **Control the secrets (M80).** An inventory of every credential on each site, secrets moved where the fewest processes can read them, scanning that blocks new leaks, and timed rotation for each kind. State the blast radius of each secret and how long rotation takes.
4. **Win the race (M81).** A patch pipeline that matches the inventory against a vulnerability feed, updates staging first, verifies, promotes and logs — with an owner for every layer down to PHP, and a rehearsed incident drill. State your time to patch against the attacker's time to exploit.
5. **Make it a business (M82).** Contracts with ownership clauses, care plans priced from measured time, a handover pack, team conventions enforced in CI, a disclosure policy, and a written position on the Cyber Resilience Act. State what you promise and what pays for it.

At each stage, write down the guarantee and its limits. "The inventory never executes a file from the site it inspects" is a stronger and more testable statement than "the tool is safe". "Every REST route refuses an anonymous request in a test" is more useful than "the plugin is secure". "We can rotate every secret on this site in forty minutes" is a promise a client can rely on. Precision makes it possible to review, test, price and improve the practice.

### Final review questions

1. Why has maintenance become the centre of a WordPress client relationship rather than an add-on?
2. What did the WP Engine dispute reveal about the WordPress update channel, and how does that connect to the 2026 supply-chain incidents?
3. Why should a care-plan price contain both a margin and a separate risk allowance, and what does a ceiling protect?
4. Under what circumstances might the Cyber Resilience Act treat a WordPress developer as a manufacturer?
5. Which of your own guarantees can you state precisely today, and which are still hopes?

<a id="glossary"></a>
# Glossary: Terms Used Throughout the Book

| Term | Meaning in this book |
| --- | --- |
| Ability | A named action registered with WordPress's Abilities API, with schemas, an execution callback and a permission callback; callable by code and, through the MCP Adapter, by AI agents. |
| Action | A WordPress hook that calls attached functions at a moment, without passing a value back. |
| Application password | A per-application credential for WordPress's APIs, revocable without changing the user's main password. |
| Autoload (Composer) | Loading a class's file automatically the first time the class is used. |
| Autoload (options) | WordPress's flag for options read into memory on every request. |
| Blast radius | What an attacker can do with a secret, combined with who and what can read it. |
| Capability | A named permission, such as `edit_posts`, checked with `current_user_can()`; roles are sets of capabilities. |
| Copy-on-write | Sharing a value's storage until one holder modifies it, then copying; why PHP arrays behave as values. |
| Drop-in | A file in `wp-content` with a reserved name, such as `object-cache.php`, that replaces part of core's behaviour. |
| Dynamic block | A block that stores attributes and is rendered by PHP on each request. |
| Escaping | Encoding a value for a specific output context so that it is treated as data. |
| Filter | A WordPress hook that passes a value through attached functions, each returning a possibly modified value. |
| Lock file | `composer.lock`: the exact versions and sources of every dependency, installed by `composer install`. |
| Must-use plugin | A plugin in `wp-content/mu-plugins` that always loads and cannot be deactivated from the admin. |
| Nonce | In WordPress, a time-limited token tied to a user and action that shows a request was intended; protection against CSRF, not authorisation. |
| Object injection | Exploiting `unserialize()` on attacker-influenced data to instantiate objects whose magic methods do harm. |
| OPcache | The PHP extension that caches compiled opcodes in shared memory. |
| Permission callback | The function a REST route or ability runs to decide whether the current request may proceed. |
| PHP-FPM | The FastCGI process manager that runs pools of PHP worker processes. |
| PSR | A PHP Framework Interop Group recommendation, such as PSR-4 for autoloading. |
| Rotation | Replacing a secret and making the old value stop working. |
| Salt | In WordPress, one of the secret values in `wp-config.php` used to sign cookies and nonces. |
| Sanitising | Cleaning input into an acceptable form. |
| Shared-nothing | The model in which each request starts with fresh state; a guarantee implemented by the PHP engine. |
| Supply-chain attack | Compromising software by attacking how it is built or delivered rather than where it runs. |
| Validation | Deciding whether input is acceptable, and rejecting it if not. |
| Virtual patching | Blocking exploitation of a known vulnerability at a firewall before the software is updated. |
| WP-Cron | WordPress's scheduler, triggered by page loads rather than by the system clock. |

<a id="references"></a>
# Technical References

These primary and secondary sources support the version details and incident descriptions in the text. Incident reporting from 2026 is recent and in places inconsistent; where sources disagree, the text says so or uses the more conservative figure.

1. PHP, [Supported Versions](https://www.php.net/supported-versions.php). Active and security support dates for each branch.
2. PHP, [PHP 8.4 release notes](https://www.php.net/releases/8.4/en.php) and [PHP 8.5 release notes](https://www.php.net/releases/8.5/en.php). Property hooks, asymmetric visibility, the pipe operator, `clone` with properties, and the URI extension.
3. PHP-FIG, [PSR-4: Autoloader](https://www.php-fig.org/psr/psr-4/) and [PER Coding Style](https://www.php-fig.org/per/coding-style/).
4. Composer, [Documentation](https://getcomposer.org/doc/). Version constraints, the lock file, and `composer audit`.
5. WordPress, [Plugin Handbook](https://developer.wordpress.org/plugins/), [REST API Handbook](https://developer.wordpress.org/rest-api/) and [Block Editor Handbook](https://developer.wordpress.org/block-editor/).
6. WordPress, [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/) and [WordPress Coding Standards](https://github.com/WordPress/WordPress-Coding-Standards).
7. WordPress Hosting Team, [WordPress 7.0 compatibility](https://make.wordpress.org/hosting/handbook/compatibility/version/7-0/). Minimum and recommended PHP versions.
8. WordPress Plugins Team, [Update on the status of the team — June 2026](https://make.wordpress.org/plugins/2026/06/13/update-on-the-status-of-the-team-june-2026/). Review queue and the update hold.
9. Patchstack, [State of WordPress Security in 2026](https://patchstack.com/whitepaper/state-of-wordpress-security-in-2026/). 2025 vulnerability counts and time to exploitation.
10. Wiz, [Exploitation in the Wild of wp2shell](https://www.wiz.io/blog/wp2shell-cve-2026-63030-cve-2026-60137). CVE-2026-63030 and CVE-2026-60137, affected versions and indicators.
11. The PHP Foundation, [Today's PHP Security Release, and How We're Strengthening PHP Security](https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/), and NCSC-NL, [php2shell operational information](https://github.com/NCSC-NL/php2shell). CVE-2026-109618 and CVE-2026-109619.
12. Help Net Security, [$20 per zero-day is already the WordPress plugin reality](https://www.helpnetsecurity.com/2026/05/22/ai-wordpress-plugin-vulnerabilities/). AI-scale plugin vulnerability discovery.
13. Anthropic, [Coordinated vulnerability disclosure dashboard](https://red.anthropic.com/2026/cvd/). Project Glasswing findings and advisories.
14. Wordfence, [Backdoored WordPress plugin detected within two hours](https://www.wordfence.com/blog/2026/07/wordfence-prism-detected-backdoored-wordpress-plugin-within-two-hours-of-it-being-introduced/); The Hacker News, [ShapedPlugin Pro plugins backdoored](https://thehackernews.com/2026/06/shapedplugin-wordpress-pro-plugins.html); BleepingComputer, [Laravel Lang packages hijacked](https://www.bleepingcomputer.com/news/security/laravel-lang-packages-hijacked-to-deploy-credential-stealing-malware/). 2026 supply-chain incidents.
15. GitGuardian, [The State of Secrets Sprawl 2026](https://www.gitguardian.com/state-of-secrets-sprawl-report-2026). Leak counts, AI-service secrets, and AI-assisted commits.
16. The Hacker News, [Over 600 Laravel apps exposed to remote code execution](https://thehackernews.com/2025/07/over-600-laravel-apps-exposed-to-remote.html). The 2025 `APP_KEY` research by GitGuardian and Synacktiv.
17. SentinelOne, [CVE-2025-11749](https://www.sentinelone.com/vulnerability-database/cve-2025-11749). The AI Engine MCP token exposure.
18. W3Techs, [Usage statistics of PHP](https://w3techs.com/technologies/details/pl-php) and [WordPress](https://w3techs.com/technologies/details/cm-wordpress). Market share figures.
19. FAIR Web Foundation, [FAIR Package Manager](https://github.com/fairpm). Federated plugin distribution.
20. European Union, [Regulation (EU) 2024/2847 (Cyber Resilience Act)](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) and [Directive (EU) 2019/882 (European Accessibility Act)](https://eur-lex.europa.eu/eli/dir/2019/882/oj).
21. W3C, [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/).
