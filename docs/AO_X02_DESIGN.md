# AO-X02-1 — Human summary and scoped evidence handoff

Design proposal for [Issue #26](https://github.com/bobrs/Application-Observatory/issues/26), prepared by **ao-ui Dev** under delegated supervisor authority, 2026-10-30. This document changes no runtime behavior and claims no usability acceptance, new collection or independent Test result. The source baseline and live `main` verified at intake were [`569fdfa26f7f8bb3c1024966a74fbd4c6d63689d`](https://github.com/bobrs/Application-Observatory/commit/569fdfa26f7f8bb3c1024966a74fbd4c6d63689d).

People should quickly see **what version is reported where, what responded, and who the sources identify**. Detailed safe JSON is a first-class outcome: an authorized AI can investigate through its existing tools, then return to compare separately collected evidence. Observatory does not become that AI's repair controller. UI deployment controls remain secondary.

## X02-4 delivered source scope — 2026-10-31

[Issue #34](https://github.com/bobrs/Application-Observatory/issues/34) adds the saved-versus-current comparison journey to accepted X02-3 baseline `d786e4507fbae777f48cbd5c65751cb62e34f04f`. [The comparison read contract](COMPARISON_V1.md) describes mandatory baseline descriptors, atomic paired read projections, compact safe summaries, exact added counts, saved-observation freshness reevaluation, budgets and unavailable-context behavior. The original manual-comparison proposal below remains historical design provenance. No collection, repair or verification action is triggered by opening the comparison.

## X02-3 delivered source scope — 2026-10-31

[Issue #32](https://github.com/bobrs/Application-Observatory/issues/32) implements focused external target pages, safe current/pinned evidence packets and bounded safe records/pages from the X02-2 baseline `5b5acfe678abf9cea7c790a09a3a03b921cff816`. [The implemented read contract](EVIDENCE_V1.md) documents exact routes, schema, omission policy, configuration fingerprints, two-ledger snapshots, budgets and limitations. Existing managed controls remain at their application anchor; local reference/normal modes remain separate. Earlier planned/proposed language below records the accepted design at its original stage; Dev implementation does not imply supervisor acceptance, live deployment or independent Test.

## X02-2 delivered source scope — 2026-10-31

The Dev source increment for [Issue #27](https://github.com/bobrs/Application-Observatory/issues/27), based on `31565bca3b1ace5990c9a6a24af15607f80c86b4`, implements `/environments` plus Applications/Environments navigation and native GET filters on both overview and portfolio. The original proposal below remains design provenance. Placement cards use the existing exact `/applications/:slug#destination-:targetId` evidence section and existing scoped archives; application detail keeps its established cards and controls. **X02-3 focused routes, safe JSON/record exports and pinned snapshots remain planned.** No incomplete export affordance is exposed.

Supported fields are `application` (known application slug), `q` (application name/slug or placement name), `stage` (configured label), `mode` (`managed`, `observe-only`, `planned`, or separately labeled `local-reference`) and `evidence`. Evidence values are `observed`, `no-observation`, `unknown`, `stale`, `contradiction`, `unresolved`, `planned`, `missing-receipt`, `unknown-receipt`, `unconfirmed`, `failed-receipt`. Independent conditions overlap: a stale contradiction matches both filters, while a matching version can coexist with an unknown receipt. Empty form values mean all. Reject unsupported/repeated fields, malformed encoding/control characters, unknown exact selectors, queries over 1024 encoded characters, search over 120 decoded characters and other fields over 160. Filters preserve their URL values across the two views; matching placement/application counts remain distinct from configured totals. Apps without placements appear when no placement-specific filter excludes them.

External summaries retain original unknown observation times, separate current from dated last-known versions, distinguish receipt conditions and preserve original reconciliation/backend/incarnation scope. They use raw read state for external facts; local reference records retain their separate meanings and capability. The runtime state/gates, SQL, ingestion, dispatch, schema, configuration limits, package pins, POST controls and archive bounds are unchanged. Existing CSP permits same-origin native GET forms on these two pages; their mutation methods remain rejected.

Dev checks use temporary fixtures only: `npm run verify` on Node 24.22.1, including 20 targets with 10,000 added mixed-scope historical observations, and optional `node scripts/capture-navigation.mjs` with project-local Chromium. The browser script saves synthetic screenshots and a source/dirty/runtime report only, checks keyboard/filter/back/anchor behavior and mobile overflow, blocks external requests and verifies unchanged ledger counts. These are developer checks, not independent Test acceptance, production performance or live deployment proof. Supervisor review and publication are attributed separately from these Dev checks.

## Three journeys and page sketches

The sketches use **illustrative states**, not live observations. Names and capabilities follow the [public placeholder configuration](../examples/external-runtime-config.example.json); versions, ages and operation outcomes below are examples only. Stage names group targets; they establish neither physical placement nor process/container/VM isolation.

### 1. Orient: portfolio → environments → exact target

```text
Applications                                      [Applications] [Environments]
Find application [________________]     Evidence [All v]
Application Observatory  No connected destinations    Operational state unknown
Aloha Observatory        QA: 1 target; Demo: 1 planned
                         QA version 1.0.0 · read 2m ago · observation only
                         Deployment actor unknown                [Open application]
                         [v Context: source, limitations, counts]
```

Keep the separate application-name link and native disclosure. Show counts of configured targets, observed placements and planned entries separately; do not count planned metadata as a running placement. Short versions link to full identity. A timestamp or `No observation` appears beside any response/version summary. The self-entry retains its original metadata and operational unknowns. Suggested steward/next role never substitutes for an observed actor.

```text
Environments                 Application [Aloha v] Stage [All v]
Find target [_____________]  Evidence [All v] Capability [All v] [Apply filters]
QA    Aloha · x01-aloha-qa       1.0.0       Read 2m ago    observe-only [Evidence]
      Version endpoint read succeeded at collection; HTTP status/latency uncollected
Demo  Aloha · demo-planned      Configured only           planned      [Details]
      No runtime collection or actions; retained archive available if present
```

Use a simple table on wide screens and labeled stacked rows on narrow screens. Show application and target together, even when grouped by stage. Filters use native GET forms with URL state; zero matches offers Clear filters. Evidence filters are `all`, `no-observation`, `unknown`, `stale`, `contradiction`, `unresolved`; separate capability filters are `managed`, `observe-only`, `planned`. Conditions may overlap. Application details use the same target rows scoped to that application and retain existing metadata/history links. No operational forms appear on the portfolio or environment overview.

### 2. Handoff: focused target → bounded safe JSON

```text
Applications / Aloha / QA / x01-aloha-qa
Aloha · QA                       observe-only (configured declaration)
Reported version 1.0.0           Full artifact + boot identity [Details]
Collected 12:00Z · recorded 12:00:02Z · evaluated 12:02Z · fresh at evaluation
Response: version read succeeded then; HTTP status + latency: uncollected
Who: collector source declared; deployment actor unknown
[Open current evidence JSON] [Download snapshot JSON] [Copyable snapshot link]

Identity + limitations     backend / application / target / configured incarnation
Desired / receipt / observed / continuation decision: separate labeled facts
Latest observation         original outcome + collection/record times + record link
Last known                 historical version when latest is unknown or stale
Recent consequential records (3)     [Complete events] [Complete directives]
[Existing managed controls]          secondary, only for managed targets
```

Use visible text for every state, modest color accents, prominent version typography, full UTC times on expansion, and full identities in selectable text. Native links/download work without JavaScript; a read-only text field provides a copyable URL. A later clipboard enhancement is optional. Long identities wrap without horizontal page overflow. Keyboard focus, disclosure labels, table headers and state explanations remain available on narrow screens.

For a managed target, `Result not received` means a directive exists without a receipt; it does not mean dispatch started. A separate observed match cannot resolve a missing/explicitly unknown receipt. Preserve the existing form handlers, same-origin/CSRF checks, one-unresolved gate, rollback witnesses and no-replay behavior. Observe-only and planned targets have no deploy, rollback or reconciliation controls. Planned details contain configuration and historical archive links only, never synthetic unknown runtime events.

### 3. Return: earlier snapshot → current persisted evidence → verify

A person saves a packet/link with exact scope and cutoff. Their AI reads it using already authorized access, follows bounded record/history links and diagnoses through its own tools. After external work and a separately initiated collector read-back, they revisit **Current evidence**. Browser refresh only reads the database; it neither requests collection nor repairs anything.

Compare scope first, then event/directive IDs, collection/record times, artifact/version/boot, receipt and continuation witness. A new incarnation/backend is a **scope replacement**, not confirmation of the earlier operation. A completed receipt without qualifying read-back remains unconfirmed. An unknown receipt plus a matching fresh read-back means `Version observed; execution outcome unknown`, even after witnessed continuation releases the change gate. If no new evidence arrived, say so; a recent render time is not verification.

Initial implementation can compare downloaded packets manually. A later comparison view can show added records and changed projections without rewriting either snapshot. Re-evaluate old observations at the new current time separately from their frozen `freshAtEvaluation` result. A copied local URL conveys neither access nor operational authority; an AI outside the local boundary needs the downloaded safe packet or separately authorized access.

## Field and state contract at the baseline

Source references below are pinned to the verified baseline: [runtime types and selectors](https://github.com/bobrs/Application-Observatory/blob/569fdfa26f7f8bb3c1024966a74fbd4c6d63689d/src/external-runtime.ts), [portfolio projection](https://github.com/bobrs/Application-Observatory/blob/569fdfa26f7f8bb3c1024966a74fbd4c6d63689d/src/portfolio.ts), [HTML presentation](https://github.com/bobrs/Application-Observatory/blob/569fdfa26f7f8bb3c1024966a74fbd4c6d63689d/src/portfolio-views.ts), [routes](https://github.com/bobrs/Application-Observatory/blob/569fdfa26f7f8bb3c1024966a74fbd4c6d63689d/src/external-routes.ts), and the [public Runtime v1 description](EXTERNAL_RUNTIME_V1.md). Function/type names identify exact mappings; proposed export fields are not existing protocol fields.

| Surface / proposed packet field | Existing source | Meaning and absence rule |
| --- | --- | --- |
| Application identity, name, purpose | `ExternalApplication`; `externalApplicationViews`; catalog `Application` for self-entry | Configured metadata / seeded historical metadata, not runtime evidence. Keep URL slug distinct from application ID. |
| Target name, stage, capability, limitations | `ExternalTarget`; `validateConfig` | `id` maps to wire `destinationId`; `instanceId` is configured incarnation. Stage and mode are declarations. No physical host/location field exists. |
| Exact active scope | `ExternalConfig.backendId` + target `applicationId`, `id`, `instanceId`; `ExternalRuntime.state` | Every current selector uses all four. `bootId` is a separately observed process identity, not a replacement for configured incarnation. |
| Reported version/artifact/boot | `ExternalEvent` observation; `state.observation` | Only `outcome: observed` supplies non-null native values; artifact is the configured `sha256:` package identity. Never fabricate a commit, provider deployment ID or response hash. |
| Latest unknown / last known | `state.observation`, `state.lastObservation` | Preserve the original latest unknown with null version/artifact/boot and its original times. Last observed success is labeled historical, not substituted as current. |
| Collection, recording, evaluation | observation `observedAt`; stored `recordedAt`; `state` clock | Display both evidence times; `evaluatedAt` is the read projection time, not new evidence. Receipt uses `startedAt`/`finishedAt`/`recordedAt`, directive uses `createdAt`. |
| Desired change | `Directive` + stored actor/rationale; `state.directive` | Intent only: ID/action/version/artifact/expected boot/time, never a deployment fact. `null` means no directive in this exact scope. |
| Separate operation result | `state.receipt`, `ExternalEvent` receipt | `completed`, `failed`, `unknown`, or absent. Artifact and directive correlation retained; completion does not establish version or health. |
| Continuation decision / gate | `ReconciliationRecord`; `state.reconciliation`, `reconciled`, `executionUnknown`, `unresolved`; `externalControls` | Preserve witness event/receipt IDs and outcomes. Decision is attributed local acknowledgment; it changes neither receipt nor execution fact. Gates remain authoritative in existing runtime code. |
| Narrow response evidence | observed event outcome/source, with Runtime v1's declared HTTP `/version` collection method | `observed` supports only `version read succeeded at collection` under the collector's stated trust boundary. Unknown means unavailable/invalid/unknown evidence, not proven HTTP failure. No structured HTTP status, duration, failure class or independent check record exists. |
| HTTP status, duration, broader health/Test | No Runtime v1 fields | Explicit `{value: null, availability: "uncollected"}` for status/latency; health/Test `not-evaluated`. Do not infer 200, zero latency, uptime or Test acceptance from stage/receipt/version. |
| Commit author; trigger initiator; deployment actor/service | No Runtime v1 fields | Each role is independently `unknown` / `uncollected`; do not derive any from desired operator, shared GitHub identity, source revision or backend ID. |
| Declared operator | directive `actor`; reconciliation `actor`, with record reference | Self-declared, unauthenticated. Rationale is explanatory text, not authority. Export may withhold unsafe text; absence and withholding are different. |
| Collector/source attribution | event `source`; `backendId`; `detail` limitations | Source is a producer-supplied claim, not a verified person/service identity. A backend ID identifies correlation scope, not authentication of a human. Free text is subject to export policy below. |
| Last attributable change | latest scoped directive/receipt/reconciliation with source time and record reference | Label the actual event kind: `operator requested`, `backend reported completed`, `operator acknowledged`. A periodic read is a collection event, not a deployment change. Missing deployment attribution stays unknown. |
| History completeness | `events` (20 preview); `state.history` (10 directives × 5 events); `historyPage` / `directivePage` (20/page) | Previews are partial and explicitly counted; complete ledgers include directives with no events. Pagination does not delete periodic observations. |

The external design uses original `StoredExternalEvent` records, not the local exercise adapter as a lossless export type. Existing local reference/exercise routes retain their own evidence semantics (`Observation`, `Decision`, `Receipt` in `src/exercise/model.ts`, `readReference`, `observationCurrent`). A normal self-entry with no connection remains unknown; no external-style packet should pretend one was collected.

### Independent facets, not one reassuring badge

| Condition in `ExternalRuntime.state` | Human summary and packet facts |
| --- | --- |
| Planned target | `Configured only`; runtime not applicable for this mode; historical archive separate. No created observation. |
| No observation | `No observation received`; current reported identity null; response unknown. No observation is not an unknown event. |
| Latest observation outcome unknown | `Latest read unknown`; retain the actual unknown event and historical `lastObservation` separately. Null identity stays null. |
| Observed, fresh | `Version observed`; original version/artifact/boot, source and both times; no health claim. |
| Observed, stale | `Last known version …; stale`; recent recording cannot freshen an old collection. |
| Directive, no receipt | `Result not received`; execution unknown; no evidence of start; unresolved unless current witnessed reconciliation permits continuation. |
| Receipt outcome unknown | `Execution outcome unknown`, even with matching fresh observation or reconciliation. Never relabel as failed/completed or replay. |
| Receipt failed | `Operation reported failed`; this says nothing conclusive about running version. Another change needs the existing separate fresh post-failure read checks. |
| Receipt completed, qualifying read-back absent | `Completed report; version unconfirmed`; unresolved until existing resolution/reconciliation criteria are met. A pre-operation observation cannot confirm it. |
| Completed plus qualifying matching fresh read-back | `Completed report + matching version observed`; identify both records and new boot criterion; no independent Test/health claim. |
| Completed plus conflicting post-operation evidence | `Contradictory evidence`; show desired versus observed version/artifact/boot and times. If stale, say `Historical contradiction; current state stale/unknown`. |
| Reconciled unresolved operation | `Operator continuation acknowledged`; show witness and whether acknowledgment is current. Original receipt absence/unknown and `executionUnknown` survive. |

Freshness preserves Runtime v1: an observed record is fresh only when **both** `evaluatedAt − observedAt ≤ 300,000 ms` and `evaluatedAt − recordedAt ≤ 300,000 ms`, following the existing accepted timestamp/skew validation (up to 30 seconds future skew at ingestion). Latest selection orders collection time, then sequence, not arrival alone. No new stricter dispatch rule is introduced. Qualifying completion requires observation at/after directive creation and receipt finish, matching version/artifact, and a changed boot when `expectedBootId` is non-null. Reconciliation has its existing stricter post-directive/post-receipt witness checks. `contradictory` and freshness are separate facts: the current implementation can retain a mismatch after that observation ages.

## Read links, snapshots and safe packets

All paths in this table are **proposed**, except the explicitly existing archives. No route is added by this document. Let `B = /applications/:slug/targets/:targetId`.

| Link | Read scope / behavior |
| --- | --- |
| `/` and `/applications/:slug` | Existing portfolio/application entry points; refine summary and add target links. Preserve legacy/local links. |
| `/environments?application=…&stage=…&evidence=…&mode=…&q=…` | New bounded, filtered current overview. Strict supported values; no arbitrary backend/URL input. |
| `B` | New current focused page for configured exact scope. Planned target gets metadata/archive-only detail. |
| `B/evidence.json` | New current safe packet: current scope, one atomic read cutoff, evaluated time and generated snapshot link. No collector bearer needed or supplied. |
| `B/evidence.json?backend=…&instance=…&eventsThrough=…&directivesThrough=…&evaluatedAt=…&config=…&projection=…` | Proposed pinned read. Exact app/target plus backend/incarnation, two immutable ledger upper bounds, fixed evaluation time, configuration fingerprint and supported projection version. Same descriptor has the same evidence/projection while its prerequisites remain available. |
| `B/history?through=…&before=…` and `B/directives?through=…&before=…` | **Existing** complete logical app/target archives across earlier backends/incarnations, 20 records/page. Original scope shown on every record. They do not become current state. |
| `B/records/events/:eventId` and `B/records/directives/:directiveId` | New single safe record reads, validated against logical app/target; pinned packet links also carry/validate snapshot bounds and original backend/incarnation. Not a cross-target ID lookup. |

Current packet creation uses one SQLite **read transaction** to capture event `seq` and directive `rowid` upper bounds and select all summary/witness records. Separate cutoffs are necessary: an event cutoff cannot freeze a directive with no events. A pinned projection applies both bounds to every query, including receipt, latest/last-known observation and reconciliation; it must not call unbounded/current `state()` and merely attach old cursors. History links freeze their corresponding cutoff; cross-ledger references inherit both. Existing `lookup` can currently find a directive beyond a page cutoff, so it is not sufficient as a pinned record link without a cutoff check.

Ledger rows are append-only in this design. Fingerprint canonical normalized **product configuration** (application metadata, backend and complete selected target declaration, including artifact pairs, capability, stage, incarnation and limitations); exclude secret/config filesystem location. Validate a supported projection version. Because configuration is not versioned in SQLite, a mismatching fingerprint, removed target, missing retained ledger, unsupported projection or invalid cutoff returns a clear **Pinned snapshot unavailable** response (409 for changed context, 404 for missing records), with no silent substitution of current configuration/state. A pinned link freezes record selection and evaluation, not availability or authentication. Preserve the downloaded packet for an enduring copy of the original safe configuration context. No snapshot persistence or new schema is required for X02-2; durable server snapshots are a later choice.

Current and archive scope must remain explicit: `current` means exact `(backendId, applicationId, destinationId, instanceId)`. Complete archives select logical `(applicationId, destinationId)` across retained earlier backends/incarnations. Packet summary uses the former; linked archive pages may use the latter and must label that widening. Planned metadata gets no active runtime facts, even if its archive contains earlier managed evidence. Configuration replacement does not authorize reuse of an old boot, receipt, gate or attribution.

### Export allowlist

Use a new versioned **evidence packet schema**, not a widened Runtime v1 ingestion payload or a raw object dump. Whitelist scope/config declarations; snapshot cutoffs/config fingerprint/projection version; evidence IDs and kinds; native version/artifact/boot; outcomes and original nulls; collection/operation/record/evaluation times; directive correlation; reconciliation witness IDs/outcomes; separate projection flags with evidence references; structured attribution claims; gaps/limitations; bounded preview/completeness metadata; validated relative record/history/source links. Include the Observatory source revision producing the projection, which is not the workload revision. Unknown fields stay absent or explicitly unavailable, never invented.

Exclude CSRF fields, collector write bearer/token, Authorization/Cookie headers, cookies, environment variables, private config location, host paths/endpoints, commands, raw logs, raw provider payloads and unrestricted text. Runtime validation bounds `source/detail` and rejects some secret patterns; actor/rationale have weaker text validation. That is **not** an export-safety guarantee. Do not spread `state`, `payload_json`, raw database rows or HTML into JSON. Default free-text actor/rationale/source/detail to `withheld` with a local record reference; export only separately reviewed allowlisted public display aliases/category labels. Preserve an original source value when safe to export; otherwise identify the omission rather than replacing it with a fabricated attribution. HTML escaping alone does not remove secrets. Existing private local archive views remain distinct from the shareable safe packet.

Each attribution slot carries `{value, availability, provenance, recordRef}`. Missing author/trigger/deployer is `unknown` with `uncollected` availability; present but unsafe declared operator is `withheld`, with provenance `self-declared, unauthenticated`. Collector source has provenance `producer-supplied declaration`; missing verified collector identity is unknown. No role is inferred from another. A future collector must define fields/trust boundaries before adding actor, native deployment/commit or response measurements. Cloudflare ingestion/account access is outside this design; no provider fixture is needed for X02-2.

Illustrative excerpt of an AI handoff (not a full schema or collected event):

```json
{
  "packetSchema": "observatory-evidence-v1-proposed",
  "illustrative": true,
  "scope": {"kind": "current", "backendId": "example-backend", "applicationId": "example-app", "destinationId": "example-target", "instanceId": "example-incarnation"},
  "facts": {
    "receipt": {"outcome": "unknown", "recordRef": "receipt-example"},
    "observation": {"outcome": "observed", "version": "1.0.0", "recordRef": "read-example"},
    "executionUnknown": true,
    "httpStatus": {"value": null, "availability": "uncollected"},
    "durationMs": {"value": null, "availability": "uncollected"},
    "deploymentActor": {"value": null, "availability": "uncollected", "provenance": "unknown", "recordRef": null}
  },
  "gaps": ["Matching version does not resolve the unknown receipt", "Health and independent Test not evaluated"]
}
```

The full packet adds exact artifact/boot, source references, original timestamps, snapshot descriptor and paging links from stored records. It never substitutes the illustrative excerpt's values into a real packet.

### Input, link and access boundaries

Validate slug → application → target membership before reading. Reuse bounded token/version/digest validation; numeric cutoffs must be safe nonnegative integers within retained ledgers and `before ≤ through + 1`. Accept only one of each documented parameter, reject extra/repeated fields and invalid timestamps, cap query length and prohibit mixed current/pinned descriptors. A client-selected evaluation time/cutoff is a requested historical view, not authenticated attestation that it was captured then.

Generate same-origin relative links from verified IDs with URL encoding; no user-supplied redirect or URL-fetch endpoint. Do not auto-link free-text sources. Future external source links require an explicit reviewed HTTPS origin/path allowlist, no userinfo, query secrets or arbitrary redirects; no such provider links are added now. Link text distinguishes `safe packet record` from `original local archive`. A reader must separately have access to either. Download uses a server-generated safe filename and JSON MIME type; retain `nosniff`, no-store, restrictive CSP/referrer policy and existing loopback/Host boundary. Do not place credentials in URLs. New GET/HEAD handlers only read: **no probes, database writes, collection requests, operations or replay**. Reading the existing write-capable runtime API with its collector credential is not the proposed AI read interface.

## Small implementation sequence and evaluation

**X02-2 next:** retain Node/TypeScript/Fastify, SQLite and server-rendered HTML/CSS; add no dependency, migration, collector, workload release or hosting change. Add the environments GET route, validated URL filters, shared concise read-only target rows, application/portfolio links and attractive responsive styling. Use existing original runtime records for external read projections. A target row may initially link to the existing exact target section/history; focused page/export affordances remain visibly future work until X02-3 exists. Preserve all normal/local routes and existing managed forms/handlers. No incomplete JSON or broken “Download” button is part of X02-2.

Correct three **read-projection gaps** as part of that bounded UI work, without changing `ExternalRuntime.state`, dispatch gates or ingestion semantics: `projectExternalTarget` discards `observedAt` when adapting an unknown observation; its contradiction copy says “Fresh” even though `state.contradictory` can persist with stale last-known evidence; and `uncertainRequestId` combines `executionUnknown || unresolved`, so generic card copy can mislabel completed-but-unconfirmed as execution unknown. New summaries retain original unknown records/times, qualify mismatch freshness separately, and distinguish no receipt, explicit unknown and completed-unconfirmed while preserving gate reasons. Do not use the adapter's empty `responseHash` as a measured value. Missing HTTP/actor/native provider fields remain explicit collection gaps, not additional Lab work on this packet.

**X02-3:** focused target and safe single-record/packet routes, read snapshot selectors and native copy/download links. **X02-4:** comparison/attribution feedback and consequential-history grouping. A new collector field or remote/team exposure requires its own bounded contract/access work; no such work is implied by UI links.

Proposed budgets are starting constraints to **measure**, not observed performance or universal SLAs. At the configured maximum (20 external apps/20 targets), render at most 20 target rows and three consequential preview records per focused page. Preserve existing 20-record archive pages and 10×5 directive preview ceilings. Default packet: one target, required latest/last-known/receipt/reconciliation/witness records plus at most 20 recent events and 10 recent directives; include complete bounded paging links/counts and explicit preview truncation. Deduplicate identical referenced records by ID; never drop the sole unknown or contradiction witness to meet a cosmetic preview. Set an initial 128 KiB uncompressed packet and 256 KiB HTML response budget; if bounded records exceed it, return an explicit bounded manifest with safe single-record/page links, no silently missing facts. Keep each single-record response bounded by its validated source limits. No “download all” unbounded expansion.

Evaluate keyboard navigation, visible filter/back/deep-link state, no-data/planned/unknown/stale/failed/unconfirmed/contradictory combinations, safe escaping/export omissions, exact scope replacement and preserved unknown after matching read-back/reconciliation. Check two simultaneous record insertions do not split a snapshot, both ledgers exclude post-cutoff records (including directive lookup), paging traverses every retained row once, changed config fails explicitly, and GET/HEAD leave ledger counts unchanged and make no target/network requests. Test read projections with meaningfully different evidence times, not assertions mirroring prose. Keep existing verification for operational invariants.

Measure server render latency and uncompressed bytes against baseline on the same named runtime/machine and a disposable large-ledger fixture (at least 10,000 observations, mixed scopes), warm and cold; record sample count and median/p95 rather than inventing a result now. Distinguish application latency from collector endpoint duration, which remains uncollected. Save desktop/narrow captures tied to the exact tested head; developer checks, supervisor review and separately attributed Test stay distinct. The next actor is ao-ui Dev for X02-2, with delegated supervisor integration/review; this design alone establishes neither implementation nor acceptance.
