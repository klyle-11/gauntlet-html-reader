
# The Gauntlet III — Systems, Networks, Clients & Craft

## Thirteen builds about real systems, real clients, radio networks, enterprise backends, and the surfaces that reveal them

This volume continues the numbering from *The Gauntlet — By Stack*. It assumes the same operating manual:

> **You do all implementation yourself. This file gives you the problem, the questions, the tradeoffs, the fences, and the proof — not the implementation.**

The center of gravity in Volume III is different from the earlier campaign. These are not mainly "learn a library" exercises. They are **boundary exercises**:

- web app vs desktop app,
- controller vs service vs persistence,
- application vs database transaction,
- browser DOM vs the information you actually want,
- platform capability vs custom code,
- design system vs decoration,
- radio medium vs network protocol,
- network existence vs network authorization,
- discoverability vs compromise,
- and AI assistance vs human authorization.

The anti-rabbit-hole protocol from the original Gauntlet still applies unchanged: **25-minute default research boxes, 45-minute deep boxes, explicit done-whens, one-line parking-lot entries, and hard out-of-scope fences.** If a research thread does not change a decision you must make in the current module, park it.

## Safety boundary for M58–M59

The networking-security modules are for **systems you own or are explicitly authorized to assess**. They teach visibility, discovery, threat modeling, misconfiguration recognition, asset inventory, and defensive verification. They do **not** include credential guessing, exploit chains, stealth/evasion, persistence, unauthorized access, or instructions for entering third-party networks.

A core lesson is:

> **Discoverable is not the same as accessible, and accessible is not the same as authorized.**

The AI-assisted lab in M59 must stop when authorization is absent. Its goal is to classify and document the boundary, not cross it.

---

## Table of contents

- [M47 — The Portfolio That Explains Itself](#m47--the-portfolio-that-explains-itself--nextjs--electron--publishing-graph--xl)
- [M48 — Announce, Discover, Reach](#m48--announce-discover-reach--reticulum-beyond-hello-world--m)
- [M49 — Carry More Than a Packet](#m49--carry-more-than-a-packet--reticulum-links-resources--mixed-media--l)
- [M50 — From Packets to Programs](#m50--from-packets-to-programs--a-networking-lab-you-can-explain--l)
- [M51 — The Boring Enterprise Slice](#m51--the-boring-enterprise-slice--spring-mvc--service--jpa--postgresql--l)
- [M52 — Small Python, Real Database](#m52--small-python-real-database--flask--psycopg--postgresql--m)
- [M53 — The Page Is the API You Do Not Have](#m53--the-page-is-the-api-you-do-not-have--an-llm-transcript-extractor--m)
- [M54 — The Radio Room](#m54--the-radio-room--a-meshtastic-client-instrument--m)
- [M55 — Ship the Client Site](#m55--ship-the-client-site--small-business-web-with-platform-first-thinking--l)
- [M56 — The Visual System](#m56--the-visual-system--graphic-design-for-a-real-identity--m)
- [M57 — Build the Avatar](#m57--build-the-avatar--2d3d-character-creator-ui--l)
- [M58 — Who Can See the Network?](#m58--who-can-see-the-network--detectability-across-lan-reticulum--meshtastic--l)
- [M59 — The Authorized Scout](#m59--the-authorized-scout--ai-assisted-network-discovery-in-a-sandbox--l)

---

## How to run this volume

Each module uses the same eleven-part shape as the original: **Story · Briefing · Trap · Feature · Decision map · Research targets · Fence · Measure ritual · Hint ladder · Slow walk · Prove it.**

For these modules, add one extra notebook page called **Boundary Map**. Before implementation, draw every process, machine, radio, database, browser context, or third-party platform involved. Put a box around the things you own and a different box around things you merely consume. Mark every place data crosses between them.

If you cannot draw the boundary, you are not ready to code the boundary.

---

# M47 — The Portfolio That Explains Itself · Next.js + Electron + publishing graph · (XL)

> **Story.** As a developer whose portfolio is also a working notebook, I want my existing Next.js site to become a desktop authoring application and public portfolio from the same body of work, so that documenting a feature becomes part of building it — and a visitor can move from project → feature → engineering note → underlying decision instead of seeing a dead gallery of finished screenshots.
>
> **MVP.** The existing Next.js portfolio runs as a packaged Electron application; the desktop version can create/edit persistent posts with explicit visibility/publishing state; public posts appear on the web portfolio; existing hardcoded posts are migrated without losing identity; projects/features can be explicitly related to posts; one interactive project view exposes those relationships through hover/click/flyout interaction; the desktop app can launch at computer login.
>
> **Acceptance criteria.**
> - Closing and reopening the Electron app preserves authored content.
> - Existing hardcoded posts survive migration with stable IDs/slugs.
> - A private post cannot be retrieved through the public-facing surface.
> - Publishing causes the intended public representation to appear through the mechanism you chose.
> - Project/feature↔post relationships live in structured data, not magic display strings.
> - The public web site still works without Electron.
> - The Electron renderer has no unrestricted Node/Electron access.
> - A packaged build can launch at login on your machine.

## Briefing

This is not “wrap Next.js in Electron and add a blog.” You are introducing at least three execution environments: **public web**, **Electron renderer**, and **Electron main**. Electron’s main process owns privileged OS capabilities; the renderer is web UI; preload/IPC is the narrow bridge. Separately, Next can be a server-backed app or a static export, and those choices change what “backend” exists inside a desktop package.

The content model is the second half of the problem. A **project** says what exists; a **feature** describes a piece of the current system; a **post** is temporal — what you learned, changed, tried, rejected, or fixed. The visualization is useful only because those are modeled distinctly and linked explicitly.

## The trap

Four traps:

1. **“Next is the backend everywhere.”** A static renderer does not secretly carry a Next server with it.
2. **“Private” is a boolean.** Private-local, private-remote-authenticated, and merely-unpublished are different architectures.
3. **Graph before data model.** Beautiful nodes do not rescue incoherent relationships.
4. **Accidentally building Notion.** Rich text, revisions, collaboration, CRDT sync, image pipelines, scheduling, search, and plugins can consume the project before publishing works once.

## The feature

Build the system in vertical slices:

1. Existing Next site runs in browser.
2. Same UI can render in Electron without privileged shortcuts.
3. One persisted post survives full process death.
4. Existing hardcoded posts migrate.
5. Visibility/publishing states become explicit.
6. Public publication works end-to-end.
7. Projects/features become structured data.
8. Posts link to projects/features.
9. An ugly relationship view works.
10. Only then make the project anatomy visualization expressive.
11. Package, launch without the dev server, test login startup.

## Decision map

1. **Electron renderer architecture.** Static Next export · local Next server · remote hosted site loaded by Electron.  
   *Axis:* simplicity/offline behavior vs server features vs code reuse.  
   *Forcing:* which server-only Next features does the current site truly need?

2. **Source of truth.** Local DB · remote DB · local authoring store with explicit publication.  
   *Forcing:* where is the authoritative private copy? Where is the authoritative public copy?

3. **Meaning of private.** Local-only · remote authenticated · remote unpublished.  
   Finish: **“A public visitor cannot obtain a private post because ____.”**

4. **Post body format.** Markdown/plain text · rich-editor JSON · HTML · MDX.  
   *Forcing:* can prose + code + nested lists + image captions survive an editor change five years later?

5. **Publishing model.** Copy to remote public store · static generation/redeploy · direct public reads from one database.  
   *Forcing:* narrate create → draft → publish → edit → unpublish.

6. **Relationship model.** project↔feature↔post cardinalities.  
   *Forcing:* can one post touch multiple features? Can one feature accumulate many posts?

7. **First visualization primitive.** DOM/SVG · canvas.  
   Use the cheapest thing that proves hover/select/flyout for your real node count.

8. **Startup behavior.** Visible · minimized/hidden; preference vs unconditional behavior.

## Research targets

- **Runtime geography — 45 min (deep).** Next static/server execution plus Electron main/renderer/preload.  
  **Done when:** you can draw where every file/database/API operation executes.
- **Electron privilege boundary — 45 min (deep).**  
  **Done when:** you can explain why an XSS becomes dramatically worse if renderer code can touch arbitrary filesystem/OS APIs.
- **Local persistence — 25 min.** Embedded SQLite-style storage vs remote persistence.  
  **Done when:** you can justify the store for a one-user authoring tool.
- **Publication architecture — 45 min (deep).**  
  **Done when:** pressing Publish has an exact byte-path you can draw.
- **Content representation — 25 min.**  
  **Done when:** three deliberately annoying posts round-trip faithfully.
- **Relationship modeling — 25 min.**  
  **Done when:** five pieces of your existing content fit without fake abstractions.
- **Packaging/startup — 25 min.**  
  **Done when:** you know what is required for a runnable local package and login startup on your OS.

## Out of scope

Multi-user accounts, comments, likes, CRDTs, collaboration, revision history, scheduled publishing, graph databases, automatic relationship extraction, full-text search, 3D graph rendering, mobile editing, auto-update infrastructure, store distribution.

And: **do not redesign the whole portfolio while debugging persistence.**

## Measure ritual

Create a boundary-test matrix:

- create → quit everything → reopen → retrieve
- publish → public site → retrieve
- unpublish → public site → absent
- private → public interface → absent
- feature → graph → linked post → navigate

**Critical number:** publicly retrievable private posts = **0**.

## Hint ladder

<details><summary>I keep getting confused about where the database call belongs</summary>

**Orient:** name the process with the privilege and the process with the UI.

**Approach:** do not ask “where is this easiest to call?” Ask “which runtime is allowed to own this resource?” If the renderer is intentionally unprivileged, local database/filesystem operations must be performed by privileged code and exposed through a narrow capability boundary, or moved to a separate server process. Draw the call from button → renderer intent → bridge/server → persistence → returned DTO.

</details>

## The slow walk

1. **Inventory the current Next app.** Mark every route/component as shared UI, web-only, desktop-only, or data.  
   **Check:** no “sort of both.”
2. **Commit the runtime/privacy/publication DSAs.**  
   **Check:** finger-walk private and public post journeys.
3. **Desktop shell only.**  
   **Check:** web still works; Electron works; no Node shortcut.
4. **One persisted post.**  
   **Check:** survives complete app death.
5. **Migrate hardcoded posts.**  
   **Check:** count, IDs, slugs, and routes survive.
6. **Post lifecycle.**  
   **Check:** dangerous transitions are attempted intentionally.
7. **Publish end-to-end.**  
   **Check:** publish/edit/unpublish exactly match the DSA.
8. **Model projects/features.**  
   **Check:** renderer contains no magic knowledge of relationships.
9. **Ugly graph.** Rectangles and lines.  
   **Check:** every edge is stored data.
10. **Expressive anatomy view.**  
    **Check:** animation reveals information; it never substitutes for it.
11. **Package/startup.**  
    **Check:** no dev server; one reboot/login; opens exactly once.

## Prove it — the three rooms

- **Interview:** explain the dual-surface system, trust boundary, publication boundary, and one architecture you rejected.
- **Design review:** answer “why not load the production site in Electron and give it filesystem access?” and “why not one remote table with `private=true`?”
- **Meetup:** “I’m turning my portfolio into the notebook I build it from — the desktop app is where I author and link engineering notes to features; the public site publishes selected pieces, and you can pull a project apart and see the work that produced it.”

**Reach-backs:** M31 Electron boundary · M26 persistence/XSS · M10 migration · M4/M39 trust boundary · M37 visualization.

---


# M48 — Announce, Discover, Reach · Reticulum beyond hello-world · (M)

> **Story.** As a resilient-networking builder, I want two Reticulum applications to discover destinations through announces and establish communication without pre-sharing an IP address, so that I understand what Reticulum substitutes for ordinary address assignment and service discovery.
>
> **MVP.** Two owned nodes/app processes: one creates a stable identity and destination, announces it with minimal application metadata; the other listens for relevant announces, records the discovered destination, requests a path if necessary, and exchanges an authenticated message.
>
> **Acceptance criteria.**
> - Node B can learn Node A’s destination without a manually assigned IP/service address.
> - Restarting A with the same stored identity preserves its destination identity.
> - Regenerating the identity visibly changes the destination.
> - Your app distinguishes “I heard an announce” from “I have an established link.”
> - Application metadata in announces is intentionally minimal.

## Briefing

M33 established the mental shift: Reticulum addresses **destinations**, not centrally allocated IP addresses. This module goes deeper into the mechanism. A destination can announce information sufficient for peers to reconstruct an outgoing destination and establish a path. The announce is not “a user came online” in the application sense; it is part identity distribution, part path establishment, and optionally a small application-specific signal.

The center of gravity is **discovery without confusing discovery with a session**.

## The trap

**Treating announces as chat messages or presence.** Announces are comparatively expensive network-control traffic and have propagation rules. If you stuff changing status, telemetry, or verbose metadata into repeated announces, you abuse the discovery mechanism.

The second trap is identity amnesia: regenerate a keypair every launch and you have built a new network identity every launch.

## The feature

Build a tiny “field notebook beacon” app:

- Node A has a persisted Reticulum identity.
- It owns a destination in a clearly named app/aspect namespace.
- It announces minimal app data: a short human label and protocol version.
- Node B registers an announce handler for your namespace.
- B stores what it learned and can attempt ordinary Reticulum communication to A.
- A restart proves identity persistence.
- A fresh identity proves identity-derived addressing.

## Decision map

1. **Persistent vs ephemeral identity.** Stable reputation/address vs disposable privacy.
2. **Application namespace/aspects.** How narrowly should your destination identify its role?
3. **Announce metadata.** Human label/protocol version only vs richer state. What belongs somewhere else?
4. **Automatic vs user-confirmed connection after discovery.** Convenience vs consent/control.
5. **Open discovery vs network-restricted discovery.** What topology are you actually building?
6. **Expiry/cache behavior.** How long does discovered information remain useful?

## Research targets

- **Destination derivation — 25 min.**  
  **Done when:** you can explain why two apps with the same destination name but different identities do not collide.
- **Announce mechanism — 45 min (deep).**  
  **Done when:** you can say what an announce carries, what it establishes, and what it is not for.
- **Path discovery/request — 25 min.**  
  **Done when:** you can describe “heard of destination” → “path known” → “communication possible.”
- **Identity persistence — 25 min.**  
  **Done when:** you can explain why losing the private key changes the identity rather than resetting a password.

## Out of scope

Public infrastructure nodes, anonymous routing research, custom cryptography, automatic peer trust, global directories, using announces as a status feed, radio hardware.

## Measure ritual

Log four timestamps: announce sent, announce observed, path available, first payload received.

**Numbers:** discovery latency and first-contact latency on your small lab topology. Then restart both ends and repeat.

## Hint ladder

<details><summary>I heard the announce but my app still cannot talk to the peer</summary>

**Orient:** discovery information and an established communication path/session are different states.

**Approach:** instrument the stages separately. Ask: did the handler receive the relevant announce? Did you reconstruct/store the outgoing destination? Does Reticulum know a path or need to request one? Are you trying to send a packet, establish a Link, or use a Resource? Make each state visible rather than treating “discovered” as a boolean called connected.

</details>

## The slow walk

1. Draw identity → destination → announce → path → communication.
2. Research the four targets.
3. Commit identity lifetime, namespace, metadata, and connection consent.
4. Persist one identity; print its destination hash. Restart.  
   **Check:** unchanged.
5. Receive relevant announces.  
   **Check:** only your namespace is recorded.
6. Establish first communication.  
   **Check:** stages are separately logged.
7. Generate a fresh identity.  
   **Check:** destination changes; old identity remains conceptually distinct.

## Prove it — the three rooms

- **Interview:** “I built announce-driven discovery and separated identity discovery, path availability, and session establishment instead of calling all three ‘connected.’”
- **Design review:** a peer wants to publish changing presence every few seconds in announce app-data. Explain why application traffic belongs elsewhere.
- **Meetup:** “I’m building Reticulum apps where the peer is discovered as a cryptographic destination rather than an IP/port pair.”

**Reach-back:** M33 identity-addressing · M7 presence-vs-persistence · M59 discoverability-vs-authorization.

---


# M49 — Carry More Than a Packet · Reticulum Links, Resources & mixed media · (L)

> **Story.** As a resilient-networking builder, I want to transfer a meaningful artifact over Reticulum and watch the same application work across two different underlying interfaces, so that “network stack independent of medium” becomes something I have measured rather than repeated.
>
> **MVP.** Two owned nodes establish a Reticulum Link and transfer a file/resource with progress, success/failure state, and integrity verification. First run over a local IP-based interface; second run over a different interface you own (serial/radio if available, otherwise a deliberately constrained second lab interface).
>
> **Acceptance criteria.**
> - A multi-packet resource arrives intact and verifies against the sender’s digest.
> - Progress/cancel/failure states are visible.
> - The application-level code does not need a rewrite when the underlying interface changes.
> - You can explain why a Link/Resource is a better fit than stuffing a large artifact into packets.
> - A constrained/slow interface changes performance, not correctness.

## Briefing

Reticulum’s Link abstraction gives you a capable encrypted channel to a single destination and supports requests/responses and larger transfers. A **Resource** is designed for data that exceeds convenient single-packet treatment. This module uses those abstractions to make the “same network over heterogeneous media” thesis tangible.

The center of gravity is **separating application semantics from transport-interface characteristics**.

## The trap

**Optimizing for the fast test medium.** An application that feels instant over local Ethernet may be absurd over low-bandwidth radio. Chunk sizes, UI expectations, retries, and metadata overhead become visible when bandwidth and latency stop being cheap.

The second trap is reinventing reliability or encryption above a stack that already offers them.

## The feature

Build a “field drop”:

- discover or pre-identify an owned destination,
- establish a Link,
- request permission to send a named artifact,
- transfer via Resource,
- show bytes/progress,
- verify integrity at receipt,
- save to a controlled directory,
- repeat over a second medium/interface.

## Decision map

1. **Packet vs Link vs Resource.** One-shot small data · session semantics · bulk transfer.
2. **File metadata.** What must be sent before bytes? Name, size, media type, digest — and what is unsafe to trust?
3. **Receiver consent.** Auto-accept from known identities vs explicit approval.
4. **Destination directory/name policy.** Prevent collisions/path surprises; do not trust a remote path.
5. **Progress semantics.** Bytes transferred vs estimated time; which remains honest on variable radio links?
6. **Failure/retry policy.** Resume, restart, or abort? Keep it bounded.

## Research targets

- **Links — 45 min (deep).**  
  **Done when:** you can explain what a Link adds beyond an isolated packet.
- **Resources — 45 min (deep).**  
  **Done when:** you can say what lifecycle/progress/failure concerns a Resource handles.
- **Interface abstraction — 25 min.**  
  **Done when:** you can list which application concerns should remain unchanged when moving from local IP to radio/serial.
- **Integrity vs confidentiality — 25 min.**  
  **Done when:** you can explain why “encrypted in transit” and “the file arrived intact/as expected” are related but distinct claims.

## Out of scope

Building your own chunking protocol, public file drops, NAT traversal internals, custom encryption, content-addressed storage, resumable multi-gigabyte transfers, BitTorrent-like swarming.

## Measure ritual

Transfer the same artifact over both media.

Record: size, wall time, average throughput, failures/retries, digest match.

The lesson is not “make radio fast.” It is whether the **application contract survives changing physical reality**.

## Hint ladder

<details><summary>I keep wanting to manually chunk the file into packets</summary>

**Orient:** ask whether you are solving an application problem or re-implementing a transport/resource abstraction.

**Approach:** first learn what Link and Resource already promise. Only add application-level chunking if you can name a requirement the existing abstraction does not meet. “I understand loops” is not a requirement.

</details>

## The slow walk

1. Pick a real but non-sensitive artifact.
2. Research Link/Resource and draw their lifecycles.
3. Commit consent, metadata, destination-path, and retry policies.
4. Establish Link; exchange a tiny request/response.
5. Transfer Resource with progress.
6. Verify digest and failure behavior.
7. Change the underlying interface; repeat without rewriting the application protocol.

## Prove it — the three rooms

- **Interview:** explain choosing Resource over packet-level reinvention and what changed when bandwidth fell.
- **Design review:** a peer wants to send base64 chunks manually and write their own retry protocol. Compare complexity and failure modes.
- **Meetup:** “I moved the same Reticulum file-drop app between different media and measured what the network abstraction actually insulated me from.”

**Reach-back:** M32 constrained hardware · M36 streams · M33/M48 Reticulum identity/discovery.

---


# M50 — From Packets to Programs · a networking lab you can explain · (L)

> **Story.** As an engineer who does not want networking to remain mysterious background magic, I want to build and observe a small routed network end to end, so that DNS, ARP/NDP, routing, TCP, TLS, NAT, sockets, and application protocols form one causal story in my head.
>
> **MVP.** A lab of at least two subnets/segments and a router (VMs, containers with network namespaces, or physical devices) containing a DNS name, an HTTP service, and packet captures for name resolution, connection setup, request, and teardown.
>
> **Acceptance criteria.**
> - A client in one segment reaches a service in another through an explicit route.
> - You can predict the next hop before looking at the capture.
> - You can distinguish link-layer discovery, IP routing, transport connection, TLS (if used), and HTTP application data.
> - Break DNS, routing, and the listening service separately; diagnose each from evidence rather than trial-and-error.
> - You can map an OS socket to the packets it produces.

## Briefing

Most developers learn networking as a vocabulary list. This build makes it one event:

> user enters a name → resolver finds an address → host decides local-vs-routed → link layer finds the next-hop interface identity → packets cross a router → TCP establishes a connection → optional TLS negotiates protection → HTTP exchanges application messages → sockets and connection state exist in the OS.

The center of gravity is **which layer owns which fact**.

## The trap

**Blaming the wrong layer.** “The network is down” might mean DNS returned nothing, no route exists, a firewall refused traffic, the service is not listening, TLS validation failed, or HTTP returned an application error.

If your troubleshooting starts with random restarts, the network still owns you.

## The feature

Use a lab you can destroy. Namespaces/containers/VMs are ideal.

Create:

- client segment A,
- router,
- server segment B,
- one DNS record,
- one HTTP service,
- optional TLS,
- capture points on client/router/server.

Break one thing at a time.

## Decision map

1. **Lab technology.** Network namespaces · containers · VMs · physical devices.
2. **Static routing vs dynamic routing.** Static is enough for this module; be able to say why.
3. **IPv4 vs IPv6 vs both.** One deeply, the other comparatively.
4. **NAT or no NAT.** Routing first; add NAT only if it teaches a specific boundary.
5. **HTTP vs HTTPS.** Add TLS after plain routing is understood.
6. **Capture point.** Client-only vs multiple points; what question does each answer?

## Research targets

- **Layer 2 vs Layer 3 — 45 min (deep).**  
  **Done when:** you can explain why an IP packet still needs a next-hop link-layer destination.
- **Routing tables — 45 min (deep).**  
  **Done when:** given source/destination and a table, you can predict the chosen route.
- **TCP lifecycle — 25 min.**  
  **Done when:** SYN/SYN-ACK/ACK and close states are causal, not mnemonic.
- **DNS resolution — 25 min.**  
  **Done when:** you can separate “name failed” from “address unreachable.”
- **NAT — 25 min.**  
  **Done when:** you can say what translation changes and what routing still has to do.
- **TLS boundary — 25 min.**  
  **Done when:** you can place encryption above TCP and below HTTP semantics.

## Out of scope

BGP, OSPF internals, enterprise switching protocols, Kubernetes networking, VPN protocol design, Wi-Fi RF engineering, offensive scanning of networks you do not own.

## Measure ritual

For one successful request, annotate a capture with:

- DNS packets,
- link-layer neighbor resolution,
- routed IP packets,
- TCP setup,
- optional TLS handshake,
- HTTP request/response,
- TCP close.

**Number:** how many distinct failures can you diagnose correctly from first evidence? Build a five-failure test and score only yourself.

## Hint ladder

<details><summary>I can ping the server IP but the website name fails</summary>

**Orient:** you have already proven some routing and reachability.

**Approach:** move upward. If the numeric address is reachable, inspect name resolution before changing routes. Ask what address the resolver returns, from which DNS server, and whether the application is trying the same protocol/port you tested.

</details>

## The slow walk

1. Draw the topology and addressing plan.
2. Configure reachability by IP only.
3. Capture one ping/connection and explain next-hop behavior.
4. Add DNS.
5. Add TCP/HTTP, then optional TLS.
6. Break DNS, route, listener, port policy, and certificate separately.
7. Write a one-page troubleshooting order from lowest useful evidence to application response.

## Prove it — the three rooms

- **Interview:** narrate one browser request from name to socket to packets to response.
- **Design review:** someone says “just add NAT.” Explain whether NAT solves the actual routing problem.
- **Meetup:** “I built a tiny routed network just so every line in a packet capture corresponds to something I can explain.”

**Reach-back:** M7 WebSockets · M34/M58 visibility · M33 Reticulum contrast.

---


# M51 — The Boring Enterprise Slice · Spring MVC → Service → JPA → PostgreSQL · (L)

> **Story.** As an enterprise backend engineer reactivating the exact shape of systems that run banks, insurers, logistics, and internal operations, I want one complete Java slice from HTTP request through MVC/controller, service rules, transaction boundary, repository, and PostgreSQL, so that I can defend where every responsibility belongs.
>
> **MVP.** An “account adjustment” or “inventory reservation” API with create/read/update operations where at least one operation modifies two related database records atomically and one business rule can fail after the first write would otherwise have happened.
>
> **Acceptance criteria.**
> - Controller concerns, service/business concerns, and persistence concerns are visibly separated.
> - DTOs, not JPA entities, define the public contract.
> - A multi-write operation either commits completely or leaves no partial state.
> - Validation failures, missing records, conflicts, and unexpected server failures have designed HTTP/error behavior.
> - An integration test hits real PostgreSQL, not only mocks.
> - SQL/query count is observable; you introduce and eliminate one N+1 or unnecessary-query problem.

## Briefing

“CRUD app” undersells enterprise Java. The useful lesson is the **responsibility chain**:

`HTTP → controller → application/service rule → transaction → repository/JPA → SQL → PostgreSQL`

Spring Data JPA reduces repository boilerplate; Spring’s transaction abstraction lets you define transactional work declaratively. That convenience makes the classic trap easier: developers stop noticing where SQL happens and where transaction boundaries actually are.

The center of gravity is **business atomicity, not annotations**.

## The trap

1. **Transaction boundary in the wrong layer.** If a controller makes two separate service calls that each commit, the business operation is not atomic.
2. **Entity leakage.** Persistence shape silently becomes API shape.
3. **Lazy-loading/N+1 surprise.** Source code appears to perform one operation; SQL logging tells another story.
4. **“Mocked green” confidence.** A mocked repository cannot prove constraints, mappings, transaction rollback, or real SQL.

## The feature

Suggested domain: **inventory reservation**.

One request reserves units for an order:

- validate request DTO,
- load inventory row,
- ensure enough available stock,
- create reservation record,
- decrement/mark reserved quantity,
- commit together,
- fail cleanly on shortage/concurrency conflict.

The exact domain can change, but the operation must require **more than one persistence effect whose partial completion would be wrong**.

## Decision map

1. **Controller DTO vs entity.** Contract stability vs less mapping.
2. **Service granularity.** Anemic pass-through methods vs application operations that represent business actions.
3. **Transaction boundary.** Repository method · service operation · controller. Which corresponds to the real unit of work?
4. **JPA derived queries vs explicit JPQL/native SQL.** Convenience vs query transparency.
5. **Optimistic vs pessimistic concurrency.** Detect conflicts vs block conflicts.
6. **Validation split.** Structural request validation vs business validation requiring database state.
7. **Error mapping.** Which failures are 400/404/409/500, and why?

## Research targets

- **Spring MVC request lifecycle — 25 min.**  
  **Done when:** you can narrate request mapping → argument binding/validation → controller → response.
- **Spring transaction semantics — 45 min (deep).**  
  **Done when:** you can explain what code belongs inside one transaction and what rollback means.
- **JPA entity lifecycle/lazy loading — 45 min (deep).**  
  **Done when:** you can predict when SQL may execute after a Java getter call.
- **PostgreSQL constraints/locking — 45 min (deep).**  
  **Done when:** you can say what belongs as a database invariant even if the service also validates it.
- **Integration testing with a real DB — 25 min.**  
  **Done when:** you can name what a mock cannot prove.

## Out of scope

Kafka, distributed transactions, CQRS, event sourcing, hexagonal-architecture perfection, dozens of entities, Kubernetes, microservice extraction.

One service. One database. One consequential transaction.

## Measure ritual

Instrument SQL and test:

- success,
- insufficient stock/business conflict,
- forced failure after first intended write,
- two concurrent attempts.

**Numbers:** committed rows/quantities after each case, SQL statement count, and query latency for one important read.

## Hint ladder

<details><summary>Where should @Transactional go?</summary>

**Orient:** forget the annotation and name the business operation that must be all-or-nothing.

**Approach:** put the transaction boundary around that unit of work. If “reserve inventory for order” means checking stock, creating a reservation, and updating availability as one invariant, those effects belong inside one transaction. The web controller should translate HTTP to the application call; it should not be the thing that defines database atomicity.

</details>

## The slow walk

1. Write the HTTP contract and the database invariants separately.
2. Draw controller/service/repository responsibilities before Spring annotations.
3. Build schema + constraints in PostgreSQL.
4. Implement the read path and observe actual SQL.
5. Implement the multi-write service transaction.
6. Force a mid-operation failure and prove rollback.
7. Add concurrency test, query logging, and one deliberately inefficient relationship access; fix it.

## Prove it — the three rooms

- **Interview:** narrate controller → service → transaction → repository → DB and show a rollback case.
- **Design review:** a peer puts all business logic in a controller because “it works.” Show what becomes untestable/coupled.
- **Meetup:** “I’m rebuilding the boring enterprise Java slice on purpose — the interesting part is proving the business operation is atomic, not stacking annotations.”

**Reach-back:** M1 contract · M2 Postgres · M10 migration · M13 state rules.

---


# M52 — Small Python, Real Database · Flask + Psycopg + PostgreSQL · (M)

> **Story.** As a Python backend engineer, I want a deliberately small Flask service talking to PostgreSQL through a transparent database layer, so that I understand request/app contexts, connection lifetime, SQL parameterization, transactions, and pooling without hiding all of them behind an ORM.
>
> **MVP.** A small “research notes” or “job leads” API with Flask application factory + blueprint structure, Psycopg, PostgreSQL, migrations/schema scripts, parameterized CRUD, one multi-statement transaction, and a bounded connection pool.
>
> **Acceptance criteria.**
> - App configuration can differ cleanly between test/dev.
> - Database credentials are not source code.
> - Queries use server-side parameter binding rather than string construction.
> - A failed multi-statement operation rolls back.
> - Connections return to the pool and do not remain “idle in transaction.”
> - An integration test runs against PostgreSQL.
> - You can explain why this service does or does not need an ORM.

## Briefing

Flask stays intentionally small. That makes the hidden machinery your job: application creation, request context, blueprints, database connection lifecycle, transaction boundaries, and deployment configuration. Psycopg 3 gives direct PostgreSQL access plus modern pooling and parameter binding.

The center of gravity is **seeing the database round trip rather than delegating it to an abstraction before you understand it**.

## The trap

**Opening a new DB connection casually per operation and leaving transaction state ambiguous.** Psycopg begins transactions in circumstances that surprise developers accustomed to autocommit-style tools. A failed statement can leave a transaction needing rollback; pooled connections make cleanup discipline even more important.

Second trap: building a home-grown ORM because plain SQL felt repetitive.

## The feature

Choose a compact domain with one relationship, for example:

`notes(id, title, body, created_at)`  
`note_tags(note_id, tag_id)`  
`tags(id, name)`

Support create/list/detail/update plus one operation that updates multiple tables atomically.

## Decision map

1. **Raw Psycopg vs SQLAlchemy.** Transparency now vs richer mapping later.
2. **Connection per request vs pool.** Simplicity vs connection establishment cost/concurrency.
3. **Application factory vs global app.** Test/config flexibility vs minimal code.
4. **Blueprint boundaries.** By route family/domain vs one giant routes module.
5. **Transaction control.** Context-managed transaction vs explicit commit/rollback.
6. **Pagination.** Offset vs cursor; reuse M1 reasoning.

## Research targets

- **Flask app factory/context — 25 min.**  
  **Done when:** you can explain why `current_app` exists and why factories improve testing/config.
- **Blueprints — 25 min.**  
  **Done when:** you can define one responsibility boundary, not merely split files.
- **Psycopg transaction behavior — 45 min (deep).**  
  **Done when:** you can explain commit/rollback after both success and exception.
- **Pooling — 25 min.**  
  **Done when:** you can explain why a pool is bounded and what happens when all connections are in use.
- **Parameterized SQL — 25 min.**  
  **Done when:** you can explain why parameters are structural protection against injection.

## Out of scope

Async Flask, Celery, ORM internals, GraphQL, websockets, elaborate repository patterns, distributed caching.

## Measure ritual

Run a small concurrent load.

Record: pool size, concurrent requests, query latency, number of open DB sessions, and whether any remain idle-in-transaction after the test.

Then force the second statement in a two-statement operation to fail and inspect the database.

## Hint ladder

<details><summary>My failed query makes every later query on the connection fail</summary>

**Orient:** the connection may still be inside a failed transaction.

**Approach:** inspect Psycopg’s transaction semantics. A database error does not mean the transaction disappeared. Your connection lifecycle must either roll back explicitly or use a context manager whose failure path rolls back before the connection returns to the pool.

</details>

## The slow walk

1. Factory + config only.
2. Register one blueprint.
3. Connect to Postgres transparently; one SELECT.
4. Add parameterized CRUD.
5. Add one transaction spanning multiple SQL statements.
6. Add pool and observe its behavior.
7. Run integration/failure tests and justify whether an ORM would improve or obscure this particular service.

## Prove it — the three rooms

- **Interview:** explain request context, pool, and rollback in one continuous story.
- **Design review:** a peer wants SQLAlchemy immediately; give the honest threshold where you would agree.
- **Meetup:** “I built a Flask/Postgres service with Psycopg specifically so connection and transaction behavior couldn’t hide from me.”

**Reach-back:** M2 PostgreSQL · M40 Python context managers · M39 parameterization.

---


# M53 — The Page Is the API You Do Not Have · an LLM transcript extractor · (M)

> **Story.** As a developer who wants durable access to my own conversations when the visible page is awkward to search/export, I want a browser-side extractor that turns a loaded LLM chat page I am authorized to access into clean structured Markdown/JSON, so that I learn resilient DOM extraction rather than copying brittle visual text.
>
> **MVP.** A DevTools/browser script first, then optionally a bookmarklet/extension or small scraper program. It identifies message boundaries and roles from the rendered page, extracts text/code/links in order, deduplicates virtualized/re-rendered rows, and exports a structured transcript.
>
> **Acceptance criteria.**
> - User and assistant messages remain in correct order with correct roles.
> - Code blocks remain code blocks rather than flattened prose.
> - Re-rendering or repeated DOM nodes do not duplicate messages.
> - Missing/virtualized content is reported as incomplete rather than silently omitted.
> - The extractor operates only on content already loaded and accessible to you; it does not bypass authentication, paywalls, rate limits, or access controls.
> - A saved fixture page can be parsed in repeatable tests.

## Briefing

When no stable API is available for the data in front of you, the rendered document becomes a **semi-structured interface**. The wrong approach is “copy `innerText` from the page.” The useful approach is to infer the page’s semantic structure:

- what element represents one transcript row?
- where is role encoded — ARIA label, heading, data attribute, surrounding structure?
- what is display chrome vs content?
- how are code blocks represented?
- is the list virtualized, so only some messages exist in the DOM?
- can the same message rerender with new wrappers?

The center of gravity is **parsing structure rather than appearance**.

## The trap

1. **CSS-class scraping.** Generated classes change constantly.
2. **Whole-page `innerText`.** Navigation, buttons, timestamps, duplicate accessibility text, and hidden elements all mix together.
3. **Assuming the DOM contains the entire conversation.** Virtualization may only render a window.
4. **“Fixing” missing content with unauthorized automation.** The correct output can be “incomplete; messages not loaded.”

## The feature

Stage 1: run manually in DevTools on a conversation you can view.

Stage 2: save a representative HTML fixture and develop a parser against it.

Stage 3: optionally package as a browser extension/bookmarklet/local utility.

Export both:

- **JSON:** stable machine-readable `{index, role, blocks:[...]}`.
- **Markdown:** human-readable transcript.

## Decision map

1. **Semantic selectors vs CSS classes.** Prefer stable attributes/roles/structure where possible.
2. **Text model.** One string per message vs blocks (`paragraph`, `code`, `quote`, `link`, etc.).
3. **Identity/deduplication.** DOM ID if stable · transcript index · normalized content fingerprint.
4. **Virtualization handling.** Extract visible only with warning · user-controlled scroll-and-collect.
5. **Mutation handling.** One-shot snapshot · MutationObserver collector.
6. **Execution surface.** DevTools script · bookmarklet · extension · Playwright against a locally saved/authenticated fixture. Start smallest.

## Research targets

- **DOM semantic/accessibility structure — 25 min.**  
  **Done when:** you can identify two selectors more stable than generated class names.
- **Tree walking vs `innerText` — 25 min.**  
  **Done when:** you can preserve code separately from prose.
- **Virtualized lists — 45 min (deep).**  
  **Done when:** you can explain why “not in DOM” is different from “not in conversation.”
- **MutationObserver — 25 min.**  
  **Done when:** you can explain collecting newly rendered rows without polling continuously.
- **HTML fixture testing — 25 min.**  
  **Done when:** the parser can be tested without the live site.

## Out of scope

Automated login, CAPTCHA bypass, access-control evasion, undocumented private APIs obtained by reverse engineering auth flows, high-volume scraping, rate-limit evasion, third-party conversations you do not have permission to access.

## Measure ritual

Create a fixture with:

- prose,
- code,
- list,
- quote,
- link,
- repeated wrapper,
- hidden accessibility copy.

**Numbers:** expected message count vs exported count; duplicate count; missing-role count; code-block preservation count.

All must be explainable.

## Hint ladder

<details><summary>I keep extracting the wrong text</summary>

**Orient:** stop asking “what text is visible?” and ask “what node is one message?”

**Approach:** inspect one known user row and one known assistant row. Find attributes or surrounding elements that encode role/order semantically. Once the row boundary is reliable, traverse children intentionally: exclude control chrome and hidden duplicate labels; convert code/pre elements as code blocks; collect ordinary text nodes in document order. Test against a saved fixture before chasing the live page again.

</details>

## The slow walk

1. Inspect one row manually.
2. Write the transcript block schema.
3. Extract two messages correctly.
4. Expand to an entire currently-rendered conversation.
5. Add code/list/link preservation.
6. Add dedupe + virtualization/incompleteness reporting.
7. Save fixtures and turn prior failures into regression tests.

## Prove it — the three rooms

- **Interview:** explain why semantic DOM extraction outlives generated classes and why virtualization changes completeness.
- **Design review:** compare DevTools script vs extension vs headless browser; choose the smallest tool that meets the need.
- **Meetup:** “I’m treating web pages like unstable semi-structured APIs and writing extractors that admit when the DOM doesn’t actually contain the whole dataset.”

**Reach-back:** M20 parser thinking · M27 selection/clipboard · your chat-archiver work.

---


# M54 — The Radio Room · a Meshtastic client instrument · (M)

> **Story.** As an off-grid networking builder, I want to connect programmatically to a Meshtastic device and turn mesh events into a small local operator console, so that LoRa mesh networking becomes observable data instead of only a phone-app experience.
>
> **MVP.** Using hardware you own, connect through one supported client interface (serial first is ideal), display the known node database, subscribe to connection/node/message events, send a test message to your own mesh, and record delivery/radio metadata useful for understanding the network.
>
> **Acceptance criteria.**
> - The program connects reliably and reports reconnect/loss distinctly.
> - Node updates change the local display without polling the whole device continuously.
> - A text message between your test nodes is observed through the client event stream.
> - You can switch between at least two client connection methods if your hardware supports them (e.g. serial and BLE/TCP), or explain their tradeoff if not.
> - Your tool never prints or exports channel keys/secrets as ordinary telemetry.

## Briefing

Meshtastic runs an off-grid LoRa mesh on small devices, while client software talks to a local radio over interfaces such as **Serial, BLE, or TCP**. The Python client API exposes a node database plus asynchronous pub/sub events for received packets and node changes.

This makes a good bridge between radio networking and ordinary software architecture: the low-power radio network is one system; your laptop-to-radio client connection is another.

The center of gravity is **not confusing the client link with the mesh link**.

## The trap

**Thinking “I connected over Bluetooth” means Bluetooth is the mesh.** BLE/serial/TCP is usually how your application controls one local Meshtastic node. LoRa is what that radio uses to communicate over the mesh.

Second trap: logging every config field casually and leaking channel/security material into your own debug artifacts.

## The feature

Build a local “radio room” dashboard/CLI:

- local device connection status,
- own node metadata,
- known-node list,
- last-heard/update indicators,
- received message/event log,
- simple send-to-own-test-node action,
- optional tiny topology/history visualization.

## Decision map

1. **Serial vs BLE vs TCP client connection.** Reliability/latency/setup vs mobility.
2. **Event-driven vs polling.** Pub/sub updates vs repeatedly fetching state.
3. **What constitutes presence.** “In node DB” vs “heard recently” vs “actively reachable.”
4. **Telemetry retention.** Session-only vs local history, and what metadata is sensitive.
5. **Message target.** Broadcast vs explicit test recipient; what is appropriate for your small lab?
6. **UI surface.** CLI/TUI first vs browser dashboard.

## Research targets

- **Meshtastic architecture — 45 min (deep).**  
  **Done when:** you can distinguish phone/laptop↔local-radio transport from radio↔radio LoRa mesh traffic.
- **Python client interfaces — 25 min.**  
  **Done when:** SerialInterface/BLEInterface/TCPInterface are three ways to reach a device, not three mesh protocols.
- **Node DB + pub/sub events — 25 min.**  
  **Done when:** you can explain how node/message updates arrive.
- **LoRa tradeoffs — 45 min (deep).**  
  **Done when:** spreading factor/bandwidth/time-on-air are concepts you can connect to latency/capacity without trying to become an RF engineer.

## Out of scope

Firmware modification, jamming/interference, extracting other users’ keys, large public-mesh enumeration, MQTT internet bridging, IP tunneling, RF amplifier design.

## Measure ritual

Send a controlled set of test messages between your devices.

Record: send count, received count, observed latency, reconnect events, last-heard changes.

Then disconnect the client link while leaving radios powered and explain which part of the system disappeared.

## Hint ladder

<details><summary>My laptop disconnected but the mesh itself seems to keep working</summary>

**Orient:** draw two links.

**Approach:** one link is laptop/application → local radio (serial/BLE/TCP). The other is local radio → remote radios over LoRa. Losing the first prevents your software from observing/controlling that radio; it does not necessarily dismantle radio-to-radio communication.

</details>

## The slow walk

1. Connect one owned device and inspect metadata.
2. Subscribe to connection events.
3. Add node update display.
4. Add receive log.
5. Add controlled send between your nodes.
6. Switch or simulate loss of the client transport.
7. Write the two-layer architecture from memory.

## Prove it — the three rooms

- **Interview:** explain client transport vs mesh transport and why you chose event-driven updates.
- **Design review:** a peer stores “node exists in DB” as “online.” Define a more honest presence signal.
- **Meetup:** “I turned my Meshtastic radio into a programmable event source so I can see the mesh rather than treating the phone app as magic.”

**Reach-back:** M7 event streams · M14 telemetry · M58 detectability.

---


# M55 — Ship the Client Site · small-business web with platform-first thinking · (L)

> **Story.** As a freelancer/design-engineer, I want to ship a polished small-business website quickly and maintainably by buying or borrowing commodity capability from a platform and writing custom code only where it creates real value, so that I learn the professional skill of *not* engineering everything.
>
> **MVP.** Take a realistic small-business brief (restaurant, artist, repair shop, nonprofit, local service, etc.), choose an appropriate hosted platform/site builder, implement the information architecture and visual identity, customize with native controls first and CSS/HTML/scripts only where justified, connect the domain/forms/analytics/accessibility basics, and produce a handoff that a nontechnical owner can operate.
>
> **Acceptance criteria.**
> - A visitor can answer what the business does, where/when/how to engage, and the primary call to action quickly.
> - The owner can update ordinary content without calling you.
> - Custom code has an explicit reason and remains small.
> - Mobile, keyboard navigation, readable contrast, forms, metadata, and performance get a basic QA pass.
> - Handoff includes domain/account ownership, content-edit instructions, backup/export reality, and a short maintenance plan.
> - You can explain why the chosen platform was a better business decision than a bespoke Next.js build.

## Briefing

A professional small-business site is often an **operations and communication problem**, not a software-product problem. The skill is choosing the smallest system that the client can afford and maintain.

Cargo is one example of the relevant philosophy: a visual site-building surface with avenues for custom CSS, page-level code view, and scripts/customization when needed. The point is not “use Cargo for everything.” The point is to understand the **platform/custom-code boundary**.

The center of gravity is **time-to-value + handoff**, not framework sophistication.

## The trap

1. **Portfolio-engineer syndrome.** Rebuild CMS, forms, image pipelines, deployment, auth, and SEO because you can.
2. **Theme prison.** Refuse all custom code and accept a site that does not express the business.
3. **Designer owns the accounts.** Client does not control domain, billing, analytics, or content.
4. **Invisible maintenance burden.** Every clever script becomes your future support contract whether you intended it or not.

## The feature

Invent or use a real small-business brief containing:

- business objective,
- primary audience,
- primary CTA,
- required pages/content,
- booking/contact/store/menu needs,
- social proof,
- ownership/maintenance expectations.

Then compare two or three platform classes before choosing.

## Decision map

1. **Platform vs custom application.** What requirement genuinely needs application logic?
2. **Cargo/Squarespace/Shopify/WordPress/etc. fit.** Portfolio/editorial, commerce, content ownership, integrations, client skill.
3. **Template/native controls vs custom CSS/HTML/JS.** Every custom line incurs maintenance.
4. **Content model.** Pages vs collections/products/posts; can the owner update them?
5. **Forms/booking/commerce.** Native integration vs third-party embed vs custom.
6. **Analytics/privacy.** What does the client actually need to know?
7. **Domain/account ownership.** Client-controlled from day one.
8. **Launch scope.** What intentionally waits for v2?

## Research targets

- **Business brief → information architecture — 45 min (deep).**  
  **Done when:** every page exists to answer a user/business question.
- **Platform comparison — 45 min (deep).**  
  **Done when:** you can reject at least one platform for a concrete operational reason.
- **Native customization surface — 25 min.**  
  **Done when:** you know what CSS/scripts/content modeling the chosen platform already supports.
- **Small-site accessibility/performance QA — 25 min.**  
  **Done when:** you have a short repeatable launch checklist.
- **Handoff/ownership — 25 min.**  
  **Done when:** you can leave and the business still owns/operates the site.

## Out of scope

Custom CMS, custom checkout, bespoke auth, headless architecture unless a requirement forces it, microservices, animation as a substitute for clarity, endless SEO tooling, perfect brand strategy.

## Measure ritual

Time the build.

Track **hours to first publishable version**, number of custom-code overrides, Lighthouse/basic performance observations, broken-link/form checks, and how many routine owner edits require code.

The interesting number is not “lines of code.” It is **how little specialized machinery you had to own**.

## Hint ladder

<details><summary>I can build this more cleanly in Next.js</summary>

**Orient:** cleaner for whom?

**Approach:** score the decision against the client’s actual lifetime: launch speed, editing autonomy, hosting/updates, cost, integrations, backups, account ownership, and your future maintenance. A bespoke app can still win — but “I enjoy the stack” is not one of the client’s requirements.

</details>

## The slow walk

1. Write the client brief and CTA.
2. Sketch sitemap + content hierarchy before picking a platform.
3. Compare platform classes and commit with rejected alternatives.
4. Build with native capabilities only.
5. Identify the three places that genuinely need customization.
6. QA mobile/accessibility/forms/performance/metadata.
7. Conduct a fake handoff where another person must edit hours, image, and CTA without you.

## Prove it — the three rooms

- **Interview/freelance pitch:** explain one feature you deliberately did *not* custom-build and why.
- **Design review:** defend one custom override against the platform-native alternative.
- **Meetup:** “I’m practicing the commercial side of web work — picking the cheapest maintainable platform and only spending custom code where it buys something visible.”

**Reach-backs:** M22 WordPress · M15 layout · M44 Figma/design · M56 visual identity.

---


# M56 — The Visual System · graphic design for a real identity · (M)

> **Story.** As a design-engineer who wants visual judgment rather than only UI implementation skill, I want to create a small but coherent graphic identity and apply it across print and screen, so that typography, hierarchy, composition, color, imagery, and reproduction constraints become decisions I can defend.
>
> **MVP.** A micro identity for a fictional/real small organization: wordmark or typographic mark, type system, restrained palette, grid, image treatment, one poster/flyer, one social asset, one simple web hero/page, and a one-page mini style guide.
>
> **Acceptance criteria.**
> - The system remains recognizable across at least three formats/aspect ratios.
> - Type roles and spacing rules are explicit rather than eyeballed independently each time.
> - A grayscale version still has hierarchy.
> - The poster works at physical viewing distance; the social asset works small.
> - Exported files use appropriate dimensions/color modes/formats for their destination.
> - You can remove one decorative element and explain whether the design improves.

## Briefing

Graphic design is not “make it pretty.” It is **organizing attention under constraints**. A strong identity lets many artifacts look related without being copies.

The center of gravity is **hierarchy + system**:

- what does the eye see first?
- what is grouped?
- what aligns?
- what repeats?
- what changes by medium?
- what remains invariant enough to create identity?

## The trap

1. **Decoration before hierarchy.**
2. **Too many fonts/colors.**
3. **Designing only at 100% zoom.** Real posters/social graphics are consumed at different distances/sizes.
4. **RGB-screen thinking applied to print.**
5. **Logo obsession.** A mark cannot rescue inconsistent typography/layout.

## The feature

Choose a client concept with enough personality to make choices meaningful: neighborhood arts event, tiny record label, community workshop, restaurant pop-up, independent software project.

Produce the identity as a system, then apply it.

## Decision map

1. **Identity center.** Typography-led · mark-led · image-led.
2. **Type pairing.** One family with range · display + text pair.
3. **Grid.** Modular · column · intentionally asymmetrical.
4. **Palette.** One dominant + accent vs broader palette.
5. **Image treatment.** Full-color · monochrome/duotone · collage · illustration.
6. **Consistency vs variation.** What never changes across artifacts?
7. **Tool.** Figma · Affinity/Adobe · open-source equivalents. Tool is secondary to output.

## Research targets

- **Visual hierarchy — 45 min (deep).**  
  **Done when:** you can explain size, weight, contrast, space, position, and repetition as attention controls.
- **Typography — 45 min (deep).**  
  **Done when:** you can choose roles for display/text/caption and adjust measure/leading/tracking intentionally.
- **Grid/composition — 25 min.**  
  **Done when:** you can draw the invisible structure behind your artifact.
- **Color/reproduction — 25 min.**  
  **Done when:** you know enough RGB/CMYK/export reality not to treat print as a screenshot.
- **Reference analysis — 25 min.**  
  Pick three pieces you admire and describe *mechanisms*, not vibes.

## Out of scope

A 100-page brand manual, bespoke type design, logo animation, packaging engineering, advanced prepress, copying a trendy studio aesthetic wholesale.

## Measure ritual

Print the poster at target size and also view it as a thumbnail.

**Numbers:** readable hierarchy at 6 feet? Main message readable at thumbnail size? Count type families, palette colors, and alignment rules — complexity should be intentional.

## Hint ladder

<details><summary>It looks boring so I keep adding things</summary>

**Orient:** identify whether the problem is identity or hierarchy.

**Approach:** temporarily turn everything grayscale and remove decorative effects. If the order of attention is weak, solve scale/spacing/alignment/type first. Add decoration only after the information works naked.

</details>

## The slow walk

1. Write five adjectives and five anti-adjectives for the identity.
2. Collect references and analyze mechanisms.
3. Build hierarchy in black/white.
4. Commit typography/grid.
5. Add restrained color/image treatment.
6. Apply to poster, social, web.
7. Print, thumbnail-test, remove one thing, document the final system.

## Prove it — the three rooms

- **Interview/design review:** defend one typographic and one composition decision against a plausible alternative.
- **Client room:** explain the system without design-school jargon.
- **Meetup:** “I’m practicing graphic design as attention engineering — making one visual system survive poster, social, and web instead of treating each as a new decoration exercise.”

**Reach-backs:** M15 layout · M44 Figma · M55 client web work.

---


# M57 — Build the Avatar · 2D/3D character creator UI · (L)

> **Story.** As a creative technologist, I want an MMORPG-style character creator where changing body, face, hair, colors, equipment, and pose updates a coherent avatar, so that I learn layered art/state composition, data-driven customization, preview rendering, and the boundary between “many options” and combinatorial chaos.
>
> **MVP.** Choose one primary rendering path: **pixel-art layered sprite** or **3D modular avatar**. A user selects several independent traits and colors, rotates/previews where appropriate, randomizes, resets, and saves/loads the character as data. Include at least one compatibility rule (e.g. helmet hides hair; one body type changes available garment).
>
> **Acceptance criteria.**
> - The saved character is a small data description, not a screenshot as source of truth.
> - Reloading the description reproduces the same avatar.
> - At least five customization dimensions compose without hand-authoring every total combination.
> - Incompatible combinations are handled by explicit rules rather than visual glitches.
> - Randomize generates only valid characters.
> - Rendering remains responsive while changing options rapidly.

## Briefing

A character creator is a visual **product configurator** disguised as game UI. The deep problem is not drawing 40 hairstyles; it is representing independent dimensions so they compose.

Pixel path:

`base body → face → hair → clothing → equipment → effects`

3D path:

`base mesh/skeleton + modular meshes/material parameters/morph targets`

The center of gravity is **data-driven composition and compatibility constraints**.

## The trap

**The combinatorial explosion.** If every shirt requires a separately exported sprite/model for every body, hair, armor, and color combination, the system collapses under asset multiplication.

Second trap: saving rendered output instead of the configuration that generated it.

## The feature

Pick your path deliberately.

### Pixel option
Layer aligned sprites on a shared canvas/grid. Palette swaps or controlled tinting provide some color variation. Export a preview image only as a derivative.

### 3D option
Use a base rig plus compatible meshes/materials and a small number of controlled morphs. Keep the asset scope tiny.

Either path needs:

- categorical option lists,
- color options,
- compatibility rules,
- randomize,
- save/load JSON,
- preset thumbnails,
- a clean “current character” model.

## Decision map

1. **Pixel vs 3D.** Asset simplicity/handmade style vs spatial preview/modular meshes.
2. **Layer/modular decomposition.** What is independently swappable?
3. **Color strategy.** Pre-authored variants · palette swap · material parameters.
4. **Compatibility rules.** Data table/rule function vs scattered UI conditions.
5. **State model.** One canonical character object vs state hidden inside controls.
6. **Rendering.** DOM/SVG/canvas for pixel · Three.js/R3F for 3D.
7. **Save format/versioning.** How will old saved characters survive new options?

## Research targets

- **Layered sprite composition OR modular 3D avatars — 45 min (deep).**  
  **Done when:** you can draw how independent options become one rendered character.
- **Finite option/state modeling — 25 min.**  
  **Done when:** the avatar is fully reproducible from a compact object.
- **Compatibility constraints — 25 min.**  
  **Done when:** “helmet hides hair” is a rule in data/logic, not a one-off CSS hack.
- **Palette/material variation — 25 min.**  
  **Done when:** you can explain the quality/performance/art tradeoff.
- **Random valid generation — 25 min.**  
  **Done when:** randomization respects constraints by construction.

## Out of scope

Full game, networking, combat stats, MMO backend, procedural human-generation research, hundreds of assets, commercial avatar interoperability, animation blending beyond one or two poses.

## Measure ritual

Generate/load 100 randomized characters.

**Numbers:** invalid combinations, render errors, average state-change time, save/load mismatches. Invalid and mismatched should be zero.

## Hint ladder

<details><summary>Every new option seems to multiply the assets I need</summary>

**Orient:** identify which differences are *independent dimensions* versus baked combinations.

**Approach:** if hair and shirt are conceptually independent, they should usually be separate layers/meshes with a shared alignment/rig contract. Reserve precomposed assets for interactions that truly cannot be decomposed. Then encode exceptions as compatibility rules instead of multiplying the whole matrix.

</details>

## The slow walk

1. Design the character JSON first.
2. Create one valid base avatar.
3. Add one independent dimension at a time.
4. Add save/load before fancy UI.
5. Add compatibility rules.
6. Add randomize/presets.
7. Add polish, transition/rotation, and one derived export.

## Prove it — the three rooms

- **Interview:** explain how the data model prevents combinatorial asset explosion.
- **Design review:** a peer stores every final combination as a separate asset. Show the growth curve and modular alternative.
- **Meetup:** “I’m building an MMO-style character creator as a data-composition problem — the fun part is making a tiny character description deterministically rebuild the visual.”

**Reach-backs:** M17 3D loop · M19 game state · M37 interactive visuals · M43 reactivity.

---


# M58 — Who Can See the Network? · detectability across LAN, Reticulum & Meshtastic · (L)

> **Story.** As a defensive networking engineer, I want to compare what evidence an ordinary LAN, a Reticulum deployment, and a Meshtastic deployment reveal to an observer on equipment I own, so that “the network is hidden” becomes a testable claim rather than an intuition.
>
> **MVP.** Build three small authorized lab scenarios: (A) ordinary Ethernet/Wi-Fi LAN, (B) Reticulum over a local interface you control, (C) Meshtastic radios you own. For each, create a **visibility inventory**: what a participant/nearby observer can notice at the physical/link/network/application boundaries, what metadata is exposed, what requires credentials/keys, and which configuration choices alter discoverability.
>
> **Acceptance criteria.**
> - You distinguish “I can detect activity” from “I can decode payloads” and from “I am authorized to participate.”
> - On the LAN, you identify evidence from local addressing/service discovery/traffic without attempting unauthorized access.
> - On Reticulum, you compare announce/interface-discovery behavior and authenticated/private interface configuration in your own lab.
> - On Meshtastic, you distinguish detectable radio activity/client-visible node information from protected message content.
> - You produce a threat model with concrete mitigations, not instructions for stealth or unauthorized entry.

## Briefing

Networks leak **different kinds of evidence** at different layers. Encryption can protect payloads while timing, radio energy, addresses, service advertisements, packet size, or discovery signals remain observable.

Three useful questions:

1. **Existence:** can an observer tell communication/network activity exists?
2. **Characterization:** can they infer protocol, participants, service type, topology, timing, or identifiers?
3. **Access/content:** can they actually join, authenticate, or read protected content?

Conflating these produces bad security claims.

Reticulum makes this especially interesting because its AutoInterface can be configured for discovery, with options around encrypted discovery and network identity; interface authentication can use network names/passphrases/IFAC. Meshtastic similarly separates radio observability from payload confidentiality.

The center of gravity is **metadata and discovery surfaces**.

## The trap

**“Encrypted means invisible.”** It does not.

The mirror trap is **“visible means compromised.”** Seeing that a radio/network/service exists is not equivalent to possessing credentials, valid interface authentication, or decryption capability.

## The feature

Build a **visibility matrix** with rows such as:

- physical/radio activity,
- MAC/link identifiers where applicable,
- IP/local addresses,
- neighbor discovery,
- DNS/mDNS/service discovery,
- listening services,
- Reticulum announces/destination metadata,
- Reticulum interface discovery,
- Meshtastic node/message metadata visible to your authorized nodes,
- timing/volume,
- encrypted payload.

Columns:

- visible to unauthenticated local participant?
- visible only after authorized join?
- encrypted?
- necessary for operation?
- configurable?
- mitigation/tradeoff?

No exploitation.

## Decision map

1. **Observer position.** On-link participant · configured peer · radio receiver you own. Visibility depends on vantage.
2. **Passive vs active observation.** Default to passive; active probes only against your explicit lab services.
3. **Metadata retention.** Store only what the experiment needs.
4. **Discoverability controls.** Disable unnecessary advertisements vs operational convenience.
5. **Authentication surface.** What protects joining versus merely seeing activity?
6. **Threat model.** Curious neighbor, unauthorized local device, lost configured device — choose one concrete adversary model at a time.

## Research targets

- **Passive vs active discovery — 25 min.**  
  **Done when:** you can classify an observation without calling every packet a scan.
- **LAN discovery surfaces — 45 min (deep).**  
  **Done when:** ARP/NDP, DHCP, DNS/mDNS, and listening services occupy distinct roles in your model.
- **Reticulum discoverability/interface authentication — 45 min (deep).**  
  **Done when:** you can explain announces, interface discovery, encrypted discovery, and IFAC as different mechanisms.
- **Radio metadata vs encrypted content — 45 min (deep).**  
  **Done when:** you can explain why an encrypted LoRa transmission can still be physically observable.
- **Threat modeling — 25 min.**  
  **Done when:** every mitigation maps to a named observer capability.

## Out of scope

Stealth/evasion, locating third-party radios, wardriving, credential capture, password guessing, exploit development, bypassing Reticulum/Meshtastic authentication, intercepting communications you are not authorized to observe.

## Measure ritual

Produce one table per network and one comparison table.

**Numbers:** count the artifacts visible at each vantage, then count how many disclose **content**, **identity/identifier**, **service capability**, or merely **activity**. The category is more important than the count.

Change one legitimate configuration in each lab and repeat.

## Hint ladder

<details><summary>I detected packets, so is the network insecure?</summary>

**Orient:** name the claim precisely.

**Approach:** ask what the observation actually proved. Radio energy may prove activity. A discoverable interface may reveal an invitation to connect. A destination announce may reveal a destination and application metadata. None of those automatically prove payload disclosure or successful authenticated participation. Security analysis starts by separating those claims.

</details>

## The slow walk

1. Define observer/vantage and authorization.
2. Build ordinary LAN visibility inventory.
3. Build Reticulum inventory.
4. Build Meshtastic inventory.
5. Classify existence/characterization/access/content separately.
6. Change one discovery/auth configuration per lab.
7. Produce a mitigation table and explicitly state what cannot be made invisible without breaking desired functionality.

## Prove it — the three rooms

- **Interview/security:** explain why encryption, authentication, and invisibility are three different properties.
- **Design review:** someone says “Reticulum is encrypted so nobody can know it’s there.” Replace the absolute claim with a layer-specific one.
- **Meetup:** “I’m comparing what three network types leak before anyone gets to payloads — activity, identifiers, announces, services — so ‘hidden network’ becomes something measurable.”

**Reach-backs:** M34 connection monitor · M33/M48 Reticulum · M54 Meshtastic · M50 networking layers.

---


# M59 — The Authorized Scout · AI-assisted network discovery in a sandbox · (L)

> **Story.** As a defender/red-team learner, I want an AI-assisted agent to receive limited observations from an isolated network I own, infer what network/services are present, propose the next *authorized* diagnostic action, and connect only through credentials/enrollment paths I explicitly provide, so that I understand how automation turns weak exposure and misconfiguration into attack surface without teaching myself to trespass.
>
> **MVP.** A sandbox containing several owned targets: an ordinary LAN service, a Reticulum node/network, and optionally a Meshtastic node/client surface. A controller gives the model structured observations from approved tools. The model classifies likely network type/service, chooses among an allowlisted set of read-only/benign probes, and — only when given valid lab credentials/configuration — performs an authorized connection and records evidence. When authorization is absent, it must stop at “detected/characterized, access not authorized.”
>
> **Acceptance criteria.**
> - Every target and allowed action is enumerated in a written authorization file before the run.
> - The agent cannot execute arbitrary shell/network commands; it chooses from a narrow tool catalog.
> - It separates observation, hypothesis, verification, authentication, and application action.
> - It never guesses credentials or attempts exploits.
> - A deliberately exposed-but-protected service is detected but not entered.
> - A deliberately misconfigured lab service is identified as a risk from evidence, then fixed and retested.
> - The run leaves an auditable decision log: evidence → hypothesis → approved action → result.

## Briefing

The useful red-team question is not “how do I make AI hack a network?” It is:

> **What machine-readable evidence turns an unknown environment into an inventory, and which defensive boundaries prevent inventory from becoming unauthorized access?**

An AI agent adds two abilities:

- **classification/planning:** connect observations into hypotheses;
- **tool selection:** choose the next allowed test.

It should *not* add unconstrained authority.

Your architecture therefore looks like:

`controlled observation → structured evidence → model hypothesis → policy gate → allowlisted tool → result`

not:

`LLM → shell`.

The center of gravity is **capability control + evidence-driven network reasoning**.

## The trap

1. **Discovery becomes permission.** The model sees a service and assumes it should enter.
2. **Arbitrary tool execution.** Natural-language model output reaches a shell directly.
3. **Agent hallucination treated as evidence.** “Probably SSH” becomes a fact without verification.
4. **Success-only evaluation.** A safe agent must sometimes refuse/stop; that is correct performance.
5. **Prompt-injection from network content.** A banner/web page can contain text designed to manipulate an agent if you feed it blindly.

## The feature

Build a sandbox controller.

### Inputs
Structured observations you generated from your owned lab, such as:

- interface inventory,
- routing table,
- neighbor table,
- DNS/mDNS results,
- a deliberately narrow service inventory from the lab,
- Reticulum announce/discovery events from your configured nodes,
- Meshtastic client/node events from owned radios.

### Allowed actions
Keep them benign and explicit, for example:

- repeat a read-only observation,
- query a known lab service’s status endpoint,
- request a Reticulum path to your own test destination,
- establish a Reticulum Link to a destination whose identity/config you supplied,
- connect to your own Meshtastic radio through its documented local client interface,
- compare observed fingerprint to expected lab inventory,
- stop/escalate to human.

### Forbidden actions
No credential guessing, vulnerability exploitation, stealth, persistence, lateral movement, arbitrary target expansion, or third-party addresses.

## Decision map

1. **Agent autonomy.** Recommend-only · execute allowlisted read-only actions · execute a tiny set of authenticated lab actions.
2. **Authorization representation.** Machine-readable target/action allowlist; what happens when evidence discovers something outside it?
3. **Evidence model.** Raw logs vs normalized observations with source/timestamp/confidence.
4. **Tool boundary.** Typed function calls vs shell strings. Why is structured capability safer?
5. **Unknown/uncertain state.** How does the agent say “I do not know”?
6. **Prompt-injection handling.** Treat remote text as untrusted data, not instructions.
7. **Stop condition.** “Detected but no authorized access path” must be a successful terminal state.

## Research targets

- **Asset discovery as inference — 45 min (deep).**  
  **Done when:** you can separate evidence from hypothesis and verification.
- **Agent/tool capability design — 45 min (deep).**  
  **Done when:** you can explain why a typed allowlisted action is safer than arbitrary command execution.
- **Authorization scope — 25 min.**  
  **Done when:** targets and actions are machine-readable before execution.
- **Prompt injection for tool-using agents — 45 min (deep).**  
  **Done when:** you can explain why network banners/pages are untrusted input.
- **Misconfiguration threat modeling — 25 min.**  
  **Done when:** the agent can identify a lab risk without needing to weaponize it.

## Out of scope

Real-world autonomous penetration testing, credential attacks, exploit payloads, persistence, malware, phishing, bypassing access controls, stealth, internet-wide scanning, attacking networks you do not own.

## Measure ritual

Prepare five lab scenarios:

1. known LAN service, authorized;
2. unknown-looking service, no authorization;
3. Reticulum destination announced, authorized identity/path;
4. Meshtastic local radio present, authorized client connection;
5. intentionally weak/misconfigured lab service, observable but no exploit required.

Score:

- correct network/service classification,
- evidence cited,
- out-of-scope target avoidance,
- unauthorized-action attempts (**must be zero**),
- successful stops when no approved access path exists,
- successful post-fix verification.

## Hint ladder

<details><summary>How does the AI “find” a network it wasn't told about?</summary>

**Orient:** “find” means infer from observations available at an authorized vantage, not magically bypass boundaries.

**Approach:** give the controller ordinary evidence from your lab — interfaces, routes, neighbor/discovery events, radio/client events, service metadata — and require the model to form hypotheses such as “this looks like a local IP service,” “this is a Reticulum announce,” or “a Meshtastic client device is attached.” It then chooses a *permitted verification action*. If there is no authorized join/authentication path, the correct next action is stop and report.

</details>

## The slow walk

1. Build the lab and authorization file without AI.
2. Define normalized evidence objects.
3. Build typed read-only tools.
4. Let the model classify evidence but execute nothing.
5. Permit one read-only verification action at a time.
6. Add explicit authenticated actions to your own Reticulum/Meshtastic/LAN targets.
7. Feed a hostile/untrusted banner string and prove it cannot expand capability.
8. Fix one deliberate misconfiguration; rerun and show the finding disappears.

## Prove it — the three rooms

- **Interview/security:** explain the difference between an autonomous shell agent and a capability-gated assessment agent.
- **Design review:** a peer wants the LLM to “just run nmap/shell commands.” Explain authorization expansion, hallucination, prompt injection, and auditability risks; defend typed tools.
- **Meetup:** “I’m building an AI network scout in a sealed lab, but the interesting part is the leash: it can infer and verify, yet discovery never grants itself permission.”

**Reach-backs:** M39 break/fix security · M34/M58 observability · M33/M48/M49 Reticulum · M54 Meshtastic · M50 network reasoning.

---

# Source shelf for Volume III

These are **seed sources**, not answer keys. Read only enough to close the module’s done-when.

## Electron / Next.js

- Electron process model: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron context isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron contextBridge API: https://www.electronjs.org/docs/latest/api/context-bridge
- Electron app/login-item settings: https://www.electronjs.org/docs/latest/api/app
- Electron distribution overview: https://www.electronjs.org/docs/latest/tutorial/distribution-overview
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports

## Reticulum

- Manual: https://reticulum.network/manual/
- Understanding Reticulum: https://reticulum.network/manual/understanding.html
- Building Networks: https://reticulum.network/manual/networks.html
- Interfaces / discovery / IFAC configuration: https://reticulum.network/manual/interfaces.html
- API reference: https://reticulum.network/manual/reference.html
- Code examples: https://reticulum.network/manual/examples.html

Notes current to the source shelf used while assembling this volume (September 2026): Reticulum documentation describes destinations/announces, Links, Resources, interface discovery, network identities, and Interface Access Codes. In particular, discoverable AutoInterface configurations include controls such as encrypted discovery; interface authentication can use network names/passphrases/IFAC. Treat those as configuration surfaces to understand, not mechanisms to bypass.

## Meshtastic

- Project/docs entry: https://meshtastic.org/
- Python client API: https://python.meshtastic.org/
- Web client: https://client.meshtastic.org/

The Python client API documents Serial, BLE, and TCP client interfaces and pub/sub topics for connection, receive, and node-update events.

## Spring / PostgreSQL

- Spring Data JPA reference: https://docs.spring.io/spring-data/jpa/reference/
- Spring transaction management: https://docs.spring.io/spring-framework/reference/data-access/transaction.html
- PostgreSQL documentation: https://www.postgresql.org/docs/
- PostgreSQL transaction isolation: https://www.postgresql.org/docs/current/transaction-iso.html

## Flask / Psycopg

- Flask application factories: https://flask.palletsprojects.com/en/stable/patterns/appfactories/
- Flask blueprints: https://flask.palletsprojects.com/en/stable/blueprints/
- Flask database tutorial: https://flask.palletsprojects.com/en/stable/tutorial/database/
- Psycopg 3 docs: https://www.psycopg.org/psycopg3/docs/
- Psycopg transaction management: https://www.psycopg.org/psycopg3/docs/basic/transactions.html
- Psycopg pooling: https://www.psycopg.org/psycopg3/docs/advanced/pool.html

## Cargo / platform-first client sites

- Cargo CSS and HTML customization: https://docs.cargo.site/css-and-html
- Cargo site/page layout: https://docs.cargo.site/site-and-page-layout

Cargo is a useful case study because it exposes visual site-building plus targeted CSS/HTML/script customization. It is not prescribed as the correct platform for every business.

---

# Campaign ordering suggestions

This volume is intentionally à la carte, but there are four useful mini-campaigns.

### Enterprise backend return
**M51 → M52 → revisit M10 → M41**

Same PostgreSQL reality through Java and Python, then migrations and operations.

### Resilient/off-grid networking
**M48 → M49 → M54 → M58 → M59**

Discover and communicate with Reticulum, transfer real artifacts, observe Meshtastic, then reason defensively about visibility and AI-assisted inventory.

### Commercial/design
**M56 → M55 → M47**

Learn visual-system thinking, ship a client site without overengineering, then bring those instincts back to your own portfolio system.

### Creative interface
**M57 → M37 → M47**

Data-driven avatar composition, interactive-diagram mechanics, then expressive project anatomy in the portfolio.

---

# Volume III closing test

At the end, take a blank page and answer these without notes:

1. **Where does this code execute?**
2. **Who owns this data?**
3. **What is the transaction / unit of work?**
4. **What state persists, and what is ephemeral?**
5. **What is visible before authentication?**
6. **What capability did I buy from a platform instead of rebuilding?**
7. **What boundary keeps a UI bug from becoming a machine/network compromise?**
8. **What did I measure instead of merely asserting?**
9. **What did I deliberately refuse to build?**
10. **Could I explain the whole feature to a peer without naming the framework first?**

If you can answer those across these thirteen modules, Volume III has done its job.
