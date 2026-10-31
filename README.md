# Application Observatory

**A lightweight, self-observing application lifecycle portal.**

Application Observatory helps small and mid-market teams understand where software stands, what evidence supports its status, and who can move it forward—without another round of status calls.

This is a **public, CC0 collaborative experiment**, primarily intended as a useful surface for teams rather than a commercial product. It starts by registering **itself** as its first application.

## Run the local portfolio (AO-INC-005)

Requires **Node.js 24.22.1 or a newer supported 24.x patch** and npm (`.node-version` pins the tested runtime). From this checkout:

```sh
npm ci
npm run verify
npm start
```

Open **http://127.0.0.1:4310**. The compact **Applications** register lists **Application Observatory** and **Hello Observatory** as separate rows, with a version/location summary, attention and responsible role. Click the **application name** to navigate, or use its separate **chevron** to expand purpose, steward, source/freshness and uncertainty in place. Enter/Space operates the native disclosure; multiple rows may stay open. Expanded context also offers **Open application**. No operational controls appear on the portfolio.

The Observatory keeps its original seeded project metadata, source revision and first-recorded timestamp; its own actual deployed state remains unknown, with zero connected concrete destinations. The original AO-INC-001 next-review text is preserved under **Application definition and historical metadata**, never used as a current decision. Hello is a known bundled reference definition with immutable accepted-source provenance, not a new database row or an invented registration/runtime timestamp. Normal mode starts no reference process and observes none. Registration/recognition never implies health, operational approval or Production readiness.

The server always binds to `127.0.0.1`, accepts only local Host names, and offers GET/HEAD pages only. Normal mode has no editing, approval or executable release controls, no client JavaScript and no automatic external requests. The inactive Hello detail explains the opt-in reference mode. Use **Ctrl-C** to stop; restart with `npm start`. An occupied port causes startup to fail instead of starting a second service; use `AO_PORT=4311 npm start` if needed. `AO_PORT=0` selects a free loopback port printed at startup.

### Local data, migration and recovery

SQLite is stored **outside the checkout** as `catalog.sqlite` in:

- macOS: `~/Library/Application Support/Application Observatory/`
- Linux: `$XDG_DATA_HOME/application-observatory/`, or `~/.local/share/application-observatory/` when unset.
- Windows: `%LOCALAPPDATA%/Application Observatory/`.

Optionally set `AO_DATA_DIR` to an **absolute, local, unsynchronized directory**. The app rejects paths within the repository (including symlink aliases) and common synchronized folders. Custom sync locations cannot be identified reliably; choose the directory accordingly. Do not put mutable SQLite data on Google Drive, OneDrive, Dropbox or a shared network filesystem.

On startup, migrations **001–004** create the catalog, local exercise ledger and external runtime evidence tables, then add indexes for bounded external-history reads and millisecond-accurate observation chronology, transactionally advancing SQLite to `user_version=4`. Existing metadata, original timestamps and all retained evidence rows are preserved. The external event and directive ledgers are read in fixed upper-sequence snapshots with bounded keyset pages; directives with no events remain inspectable. A newer schema causes startup to fail rather than downgrade it. The self-entry is inserted only when absent; restarting neither duplicates it nor overwrites its metadata. No operational observations about the real Observatory are inferred; its environment states remain explicitly unknown.

If you need a rollback path to an older increment, back up its stopped database before the first run of this version. Older binaries refuse the upgraded schema-4 database; use matching source or the original backup.

## Run the disposable release exercise (AO-INC-002)

With the pinned runtime selected and build complete:

```sh
npm run exercise
```

Open the printed loopback URL, drill into **Application Observatory**, then expand **Earlier data-only demonstration** and choose **Open local release exercise**. This opt-in mode creates a **separate generated local workspace**, including its own catalog/ledger and two trusted Node fixture processes. It never uses your normal operator data. **Dev Sandbox — Development** and **Test Sandbox — Test** are concrete destinations with distinct stable instance IDs; Production cannot be selected. The two bundled sample versions are data payloads, not Observatory builds or executable candidate code.

1. Observe each destination to obtain a sourced snapshot of its served bytes.
2. Select a sample version and concrete destination, then review the exact digest, instance, boot, expected generation and readiness. Observations and requests expire for action purposes after five minutes.
3. Record a recommendation, decline/deferral, or **bounded demo authorization**, with a self-declared actor/role and rationale. Recommendations cannot enable activation. Only fixed stated prerequisites are evaluated; rationale is not an executable condition.
4. Explicitly apply the exact sample. The controller rechecks conditions, records dispatch intent before sending, and the target checks the expected generation. A consumed request cannot dispatch twice.
5. Separately **Observe target**. A receipt does not update observations. A fresh loopback reader hashes served bytes; it is not independent organizational Test acceptance or a health attestation. Health remains not evaluated.

The optional **Demonstration faults** are explicitly injected: refusal before activation, or loss of the receipt after the fixture really changes. A stale request can be demonstrated with two review tabs: approve both against one generation, apply one, then attempt the other. A missing receipt, crash or unreadable target is **unknown**, never automatic success or automatic retry. Earlier observations remain historical; mismatching evidence is preserved in the request timeline.

Use Ctrl-C and wait for exit to stop the controller and its two owned targets. The printed workspace is retained for review. To resume that **previously generated marked workspace**, set `AO_EXERCISE_DIR` to its absolute path before `npm run exercise`. Arbitrary/unmarked directories are refused; one live controller is permitted per workspace. Stable destination identities persist, but each target gets a fresh boot identity, invalidating old unused authorizations. Previously dispatched requests without receipts recover as unknown and are never automatically resent. Temporary directories may eventually be removed by the OS; this is not durable production history. After recording any needed evidence and stopping all processes, remove only the exact generated workspace to clean up the exercise.

Only fixed bundled payloads and local targets are supported. There are no commands, user-supplied target paths/endpoints, external APIs, Production actions, IAM or general deployment adapters. POST forms require same-origin checks and a CSRF token. The exercise's same-origin referrer policy allows native forms to carry a checkable Origin without sending referrers to external sites; normal catalog pages retain their original policy. These are local safeguards, not authenticated organizational authority or an isolation boundary against a malicious same-user process.

For a basic backup, stop the app and wait for exit, then copy `catalog.sqlite` to a separate local backup location. To check a restore, copy that backup into a new local data directory and start with `AO_DATA_DIR` pointing to it. Confirm the self-entry and original timestamp before using the restored copy. Do not copy a live database, overwrite your original data, or infer recoverability from a successful start. There is no automated backup integration.

### Developer checks and UI evidence

`npm run verify` type-checks, builds and runs Node tests. All tests use separately created temporary directories and remove them afterward; none use operator data. Checks include repeated seed, persistence across an actual server-process restart, explicit unknowns/provenance, read-only HTTP behavior and safe rendering. Tests require the compiled output; run `npm run build` before invoking `npm test` alone.

Optional browser demo (macOS/Linux shell):

```sh
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright npx playwright install chromium
npm run build
npm run demo
```

This installs a project-local browser, launches a disposable loopback instance, checks navigation and desktop/mobile layouts, and writes four screenshots plus `demo.json` to ignored `test-results/demo/`. It closes the browser/server and removes its data fixture. The report records the source commit and dirty state, environment, browser version and observed results. [Committed developer evidence and screenshots](docs/evidence/ao-inc-001/README.md) identify their source revision; the increment PR records final-head validation. Developer evidence is not independent Test acceptance; the native SQLite binding still needs checking on platforms other than those actually tested.

`npm run demo:exercise` captures the distinct-stage exercise, success, decline/refusal, injected failure, stale request, missing receipt and unreadable observation using disposable targets. Screenshots/report go to ignored `test-results/exercise/`. `npm run verify` also exercises a real controller SIGKILL after target mutation, resume/reconciliation, duplicate submission, migration and scope checks. No operator data is used. [AO-INC-002 evidence and screenshots](docs/evidence/ao-inc-002/README.md) identify their clean source revision; the PR records final-head checks.

## Run three real reference destinations (AO-INC-003B)

Step A is accepted and [merged in its separate repository](https://github.com/bobrs/observatory-hello-reference/pull/1). [Step B / PR #8](https://github.com/bobrs/Application-Observatory/pull/8) merged at `dcb893848b28caecf5dd0c3535a9f4872c4ac029`. AO-INC-004 changes presentation while preserving those accepted executable boundaries.

```sh
npm ci
npm run verify
AO_PORT=0 npm run reference
```

Open the printed URL, then click **Hello Observatory**. The opt-in mode uses the same Node/TypeScript/Fastify/SQLite stack and native HTML forms. No new dependencies, migration, hosting tools or browser JavaScript are required. The portfolio remains free of operational forms and the real Observatory self-entry remains read-only/unknown. The previous `npm run exercise` data-fixture mode and history keep their original meaning. The legacy `/reference` entry point and request/POST routes remain compatible.

The controller creates a separate generated local workspace, retains verified copies of the [three accepted independent app packages](fixtures/reference/README.md), and starts three owned processes with distinct destination/instance IDs, runtime directories and loopback endpoints:

| Destination | Stage | Initial package |
| --- | --- | --- |
| Dev Reference | Development | 1.2.0 |
| Test Reference | Test | 1.1.0 |
| Demo Production | Production — **DISPOSABLE DEMO ONLY, NOT REAL PRODUCTION** | 1.0.0 |

1. **Refresh observations** reads all three actual `/version` endpoints, separately, with a bounded timeout for each. Initially no observations are invented from startup. Open any app to see its own bold baked version.
2. On **Test Reference**, choose **Change version** to preselect that destination in the one shared form. Select **1.2.0**, review readiness, enter a self-declared name/role and record the exact bounded demo authorization. Click **Upgrade to 1.2.0** separately. The old process stops and the verified selected package starts in a new process; brief unavailability is expected.
3. The receipt is execution evidence only. Click **Observe target** or return and **Refresh observations**. Test now reports 1.2.0; Development and demo-Production remain unchanged.
4. Select **1.1.0 → Test Reference**, record a fresh decision and explicitly **Rollback to 1.1.0**. It starts the original retained package, never rebuilds an old version label or rewrites history. Refresh and open the actual Test app to check the result.

The Hello detail groups concrete destination instances by stage and prioritizes observed version, time/source, short artifact identity and **Open app**. Only here are Refresh observations and release controls available. The collapsed portfolio row shows a compact version/attention summary; sources, timestamps and wider context are progressively disclosed. Evidence disclosures retain full digests, separate HTTP response hashes, instance/boot identities, decision/request hashes and timelines. A changing response hash is not the immutable whole-package digest. Freshness is evaluated when rendering; an idle page does not auto-poll. After five minutes or a runtime change, refresh is required. The endpoint is a same-host runtime report validated against the accepted mapping and owned context, not hostile-host attestation, health or independent Test acceptance.

Under **Demonstration faults**, refusal leaves the old app intact; startup failure stops the old app and leaves that destination unavailable; withheld receipt really starts the package but records an unknown execution outcome. A later matching observation does not rewrite the unknown receipt. Stale requests, expired decisions and consumed requests cannot dispatch again. A failed refresh makes current state unavailable and labels the last-known version/time historical without erasing the other two observations.

Use Ctrl-C and wait for the controller and all its owned children to exit. The printed workspace is retained as disposable evidence. To explicitly resume that marked reference workspace, set `AO_REFERENCE_DIR` to its exact absolute path before `npm run reference`. One controller may own it. Resume creates fresh boots from each destination's last successfully retained selection (or its initial selection), **not continuous runtime or replay of an old request**. A startup failure therefore needs this explicit stop/resume or a new workspace; there is no automatic recovery/rollback. Earlier authorizations become stale, missing terminal receipts recover as unknown and all old observations remain historical until refreshed. There is no arbitrary endpoint/path/command input, remote control, real Production, registry, adapter platform, CI or external deployment.

`npm run demo:reference` runs the browser walkthrough and writes source-stamped desktop/mobile screenshots and a report into ignored `test-results/reference/`; `npm run demo` and `npm run demo:exercise` check the accepted earlier surfaces. All use disposable data and owned processes. [Committed Step B evidence and screenshots](docs/evidence/ao-inc-003b/README.md) identify the clean implementation source; the PR records the exact final tested head. Only macOS arm64/Chromium is exercised here; no independent Test reviewer is designated.

## Compact rows, contextual entry and pending decisions (AO-INC-005)

[Issue #11](https://github.com/bobrs/Application-Observatory/issues/11) and [Dev intake](https://github.com/bobrs/Application-Observatory/issues/11#issuecomment-6488333113) record the bounded scope and direct Sponsor authorization. This feature branch awaits PM review and separate Sponsor merge authorization. The earlier [AO-INC-004 / PR #10](https://github.com/bobrs/Application-Observatory/pull/10) merged unchanged at `64ba416a946d374fcbb9c04da7c42ed593b905b6`.

The portfolio has no hero or repeated caution panel. Native `details/summary` chevrons are separate siblings of application navigation links, with no nested controls or accordion JavaScript. Collapsed rows target 64–80px on desktop when content permits; mobile/long content wraps. General limits remain in secondary help and expanded context; Unknown never means healthy or approved.

Inside an application: **destinations → Pending changes & decisions → shared proposal form → three-entry recent activity → disclosed full history/evidence**. Active owned reference cards expose **Change version**. It navigates to the existing Hello detail with an allowlisted `destination` query and `#propose-change`; invalid/duplicate/unknown selections return a safe error. The GET only selects and scrolls to the form. It does not create a request, declare authority, observe or dispatch. Unconnected, stopped and synthetic targets do not gain executable entry points; unknown/stale observations on a live target still face unchanged readiness checks.

The pending list projects existing records, including multiple applicable requests for one destination: unused requests with current readiness, awaiting a decision or holding a valid exact declared authorization. Recommendations, deferrals, declines, expiry, stale state, consumed actions and unresolved pre-dispatch refusals stay in history. A later applicable decision can supersede a pre-dispatch refusal under the existing controller rules. No pending items means **No pending changes recorded**, not all approved. Missing receipts remain execution uncertainty alongside separate observed versions. Suggested next steps are labeled suggestions; self-declared authority and execution capability remain distinct.

`npm run demo:refinement` checks keyboard expand versus navigation, read-only GETs, contextual preselection, pending/consumed ordering, desktop/mobile, and a clearly synthetic 30-application register with long names/descriptions. Existing `demo`, `demo:exercise`, `demo:reference` and `demo:portfolio` retain normal/fixture/real upgrade-rollback and 0/1/3/6-instance coverage. Reports go to ignored `test-results/`; screenshots identify exact source and dirty state. [Committed AO-INC-005 screenshots and reports](docs/evidence/ao-inc-005/README.md) identify the clean source; the PR records final-head repeats. No persistence model/schema/seed, framework/dependency, controller/authorization/verification/observation/rollback, registration, target, integration or permission changes are introduced.

## External Runtime v1 (AO-X01)

This opt-in mode projects up to 20 configured applications and 20 targets, each assigned a logical Development, Test, QA or Demo label. Managed targets support configured directives and evidence; observe-only targets accept observations without actions; planned targets show metadata without runtime endpoints or fabricated observations. Configuration declarations do not establish backend capability or health. The same-origin Observatory server stays loopback-bound. `npm start` remains read-only when external settings are absent. To enable it, provide both `AO_EXTERNAL_CONFIG` (absolute private JSON, file mode `0600`) and `AO_EXTERNAL_TOKEN` (private bearer secret, at least 24 characters). See [the public-safe placeholder config](examples/external-runtime-config.example.json) and [External Runtime v1 details](docs/EXTERNAL_RUNTIME_V1.md). Do not commit the real config or token. Operator config supplies metadata, backend/target/instance IDs and allowlisted version/artifact pairs; it contains no executable, endpoint, host path or command.

The Hello detail page stores deploy/version-change or retained-artifact rollback directives with a self-declared actor/rationale. The external client polls `/api/runtime/v1/targets/:targetId/directive` and submits receipts or separately collected observations to `/api/runtime/v1/targets/:targetId/events` with the bearer token. Observatory does not run external host commands or probe the target while rendering. A receipt does not confirm a version; missing/unknown outcomes block another directive, and completed changes require a fresh matching observation after the receipt. An operator can record an auditable continuation decision against an exact fresh readback; this does not alter the unknown receipt or claim success. If the target is unavailable, its owner must repair it and obtain a readback first. Contradictions and stale evidence stay visible. External mode and `--reference` / `--exercise` cannot run together. Migrations 003–004 preserve directives/events and index bounded history reads across restart; the Hello detail shows recent previews and links to a fixed-size read-only event-history page. Restoring this database does not restore external client claim state.

## AO-X02 evidence handoff design

[AO-X02-1 design](docs/AO_X02_DESIGN.md), tracked in [Issue #26](https://github.com/bobrs/Application-Observatory/issues/26), proposes the human summary → scoped safe JSON handoff → return/verification journey, source-mapped fields/states, and bounded read-only routes. It is a design proposal; the new environment, focused-target and export routes are not implemented by this document.

## Earlier executive-first layout and evidence

[AO-INC-004 design and copy](docs/AO_INC_004_DESIGN.md) records the wireframes, scope/provenance, reversible migration and evidence distinctions from [Issue #9](https://github.com/bobrs/Application-Observatory/issues/9). The Sponsor directly authorized beginning development; its accepted merge is recorded in [Issue #9](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487788461). The original pre-merge design/evidence remains historical provenance.

The application page shows concrete instances grouped by stage, recent consequential activity, declared decisions with scope/conditions/identity assurance/expiry, and next responsible role. A recorded directive can exist without an executable request. Governance standing does not supply execution credentials. Historical seeded review steps remain disclosed as history. A consumed request clearly requires a new decision for any further change; original criteria/current reuse checks remain available without reading as retrospective execution errors.

The presentation accepts **zero, one or many instances per stage**. `npm run demo:portfolio` checks the executive-to-operator journey, mobile/desktop and clearly labeled synthetic zero/one/three/six-instance and 24-application layouts. These extra shapes exist only in the capture script's separate test server: no new application/target registration, process, endpoint or observation is created. Only the original three accepted reference destinations can execute. Output goes to ignored `test-results/portfolio/` with exact source/dirty-state reports. [Committed AO-INC-004 evidence and screenshots](docs/evidence/ao-inc-004/README.md) identify the clean implementation source; the PR records final-head checks.

No catalog/schema, dependency, launcher/controller, package, IAM, permission or integration changes are needed. Reverting this layout to accepted main restores the earlier UI without a database rollback. Larger-portfolio search/pagination, editable application registration/directives, new destinations and monitoring remain future decisions.

## Prime directive: mutual intelligibility

Every consequential assertion about an application's state, purpose, readiness, or future should be intelligible, attributable, grounded, and open to correction.

Manual entries, APIs, scrapes, CI results, and AI interpretations are welcome when source, time, scope, and limits are visible. A claim is not verification. An approval is not a deployment. A deployment is not proof of health.

## First development target: v0.1

The original full target spans separately authorized increments. AO-INC-001 implements the read-only self-catalog; AO-INC-002 adds an expressly authorized fixture-only control exercise. The broader features below are not automatically authorized by that exception.

- **Application list:** name, purpose, owner or steward, high-level Development/Test/Production state, and next meaningful decision.
- **Application detail:** one or more Development candidates, recorded versions in Test and Production, notes, history, and explicit unknowns.
- **Promotion review:** record a version-specific recommendation, approval declaration, request for changes, or deferral, with attribution and conditions.
- **History:** show observations, corrections, and decisions without silently rewriting prior claims.

**Recording an approval does not deploy anything or change the reported running version.** The first useful version requires no production access, deployment credentials, infrastructure changes, or GhostSentry3 integration.

## Deliberation roles

- **PM gate — ChatGPT:** product intent, scope, acceptance criteria, challenge and review.
- **Dev gate — Codex:** technical feasibility, proposed approach, evidence from authorized implementation.
- **Product Sponsor / gopher — repository owner:** final product decisions, bounded work authorization, operational action.
- **Test — separately designated:** testing and intake acceptance; Dev or PM review does not automatically count as independent Test sign-off.

Current implementation review is [AO-INC-005 / Issue #11](https://github.com/bobrs/Application-Observatory/issues/11). [AO-INC-004 / Issue #9](https://github.com/bobrs/Application-Observatory/issues/9) is complete. [AO-INC-003 / Issue #7](https://github.com/bobrs/Application-Observatory/issues/7) records the completed reference increment. The accepted earlier fixture gate is [AO-INC-002 / Issue #5](https://github.com/bobrs/Application-Observatory/issues/5). [AO-INC-001 / Issue #3](https://github.com/bobrs/Application-Observatory/issues/3) records the accepted self-catalog, and [AO-GATE-001 / Issue #1](https://github.com/bobrs/Application-Observatory/issues/1) retains the continuity deliberation. Read [DECISIONS](docs/DECISIONS.md) for provenance and bounded Sponsor instructions, and [GATES_AND_ROLES](docs/GATES_AND_ROLES.md) for the handoff convention. The initial [CODEX_INTAKE](docs/CODEX_INTAKE.md) remains available as provenance.

## Explore the documents

- [Product brief](docs/PRODUCT_BRIEF.md)
- [MVP v0.1 and acceptance criteria](docs/MVP_V0.1.md)
- [Gate semantics and roles](docs/GATES_AND_ROLES.md)
- [Preferred technical paths](docs/PREFERRED_STACK.md)
- [Machine-readable advisory preferences](standards/technology-preferences.yaml)
- [Codex planning handoff](docs/CODEX_INTAKE.md)
- [Decisions and open questions](docs/DECISIONS.md)
- [Future possibilities, not MVP requirements](docs/FUTURE_HORIZON.md)
- [Illustrative self-entry](examples/self-catalog.yaml)
- [Codex repository instructions](AGENTS.md)

## Public-domain intent

This repository includes the [CC0 1.0 Universal](LICENSE) dedication so others can study, adapt, and reuse the materials. No warranty, certification, or production readiness is implied. Contributions and alternate approaches are welcome; the technical preference profile describes familiarity, **not prohibitions**.

## Present status

The documentation continuity increment was accepted and [PR #2 merged](https://github.com/bobrs/Application-Observatory/pull/2); [Issue #1 records the actual outcome](https://github.com/bobrs/Application-Observatory/issues/1#issuecomment-6481151297).

[PR #4](https://github.com/bobrs/Application-Observatory/pull/4) merged the self-catalog as `f19a0ac2758a4d59709c06fbf5d75d9611b46545`; [Issue #3](https://github.com/bobrs/Application-Observatory/issues/3#issuecomment-6482136137) records Sponsor-reported successful local use/visual acceptance, separate merge authorization and actual completion. This is not independent Test acceptance.

[PR #6](https://github.com/bobrs/Application-Observatory/pull/6) merged AO-INC-002 as `bbe838c366bbd33f759fb6074a2b20993dae152a`. Step A reference PR #1 merged as `da5731368d49c0426fd57a52588ff3db3e4a69e2`. The Sponsor directly authorized bounded **AO-INC-003B** development in the Dev session; [Issue #7 continuity](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662) and [DECISIONS](docs/DECISIONS.md) record attribution and exclusions. Step B subsequently merged unchanged as `dcb893848b28caecf5dd0c3535a9f4872c4ac029`; [Issue #7 completion](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6487105707) distinguishes Dev evidence, PM acceptance, direct Sponsor merge authorization and the actual merge. The Sponsor separately authorized beginning Issue #9 development; [Dev intake](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487106032) and [DECISIONS](docs/DECISIONS.md) record this bounded first layout slice. AO-INC-004 merged unchanged as `64ba416a946d374fcbb9c04da7c42ed593b905b6`; [Issue #9 completion](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487788461) distinguishes PM acceptance, direct Sponsor authorization and actual merge. The Sponsor subsequently authorized the bounded AO-INC-005 interface refinement in Issue #11. This new branch awaits PM review and separate Sponsor merge authorization. No real Production, external deployment, health or independent Test acceptance is established.
