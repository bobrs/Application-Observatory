# Application Observatory

**A lightweight, self-observing application lifecycle portal.**

Application Observatory helps small and mid-market teams understand where software stands, what evidence supports its status, and who can move it forward—without another round of status calls.

This is a **public, CC0 collaborative experiment**, primarily intended as a useful surface for teams rather than a commercial product. It starts by registering **itself** as its first application.

## Run the local self-catalog (AO-INC-001)

Requires **Node.js 24.22.1 or a newer supported 24.x patch** and npm (`.node-version` pins the tested runtime). From this checkout:

```sh
npm ci
npm run verify
npm start
```

Open **http://127.0.0.1:4310**. Follow **View application** for the self-entry's detail. Both pages show Development, Test and Production as unknown, with no recorded versions or observation sources. Project metadata is explicitly seeded, with source references and its first-recorded timestamp; that timestamp is not a runtime observation. The recorded next step is PM review followed by separate Sponsor merge authorization, labeled as a snapshot rather than live workflow state.

The server always binds to `127.0.0.1`, accepts only local Host names, and offers GET/HEAD pages only. There are no editing, candidate or approval controls, no client JavaScript, and no automatic external requests. Use **Ctrl-C** to stop; restart with `npm start`. An occupied port causes startup to fail instead of starting a second service; use `AO_PORT=4311 npm start` if needed. `AO_PORT=0` selects a free loopback port printed at startup.

### Local data, migration and recovery

SQLite is stored **outside the checkout** as `catalog.sqlite` in:

- macOS: `~/Library/Application Support/Application Observatory/`
- Linux: `$XDG_DATA_HOME/application-observatory/`, or `~/.local/share/application-observatory/` when unset.
- Windows: `%LOCALAPPDATA%/Application Observatory/`.

Optionally set `AO_DATA_DIR` to an **absolute, local, unsynchronized directory**. The app rejects paths within the repository (including symlink aliases) and common synchronized folders. Custom sync locations cannot be identified reliably; choose the directory accordingly. Do not put mutable SQLite data on Google Drive, OneDrive, Dropbox or a shared network filesystem.

On startup, migration **001** creates the catalog table and migration **002** adds the exercise ledger, transactionally advancing SQLite to `user_version=2`. Existing schema-1 metadata and original timestamps are preserved. A newer schema causes startup to fail rather than downgrade it. The self-entry is inserted only when absent; restarting neither duplicates it nor overwrites its metadata. No operational observations about the real Observatory are inferred; its environment states remain explicitly unknown.

If you need a rollback path to AO-INC-001, back up its stopped schema-1 database before the first run of this version. The older binary will refuse the upgraded schema-2 database; use the matching source version or your original backup.

## Run the disposable release exercise (AO-INC-002)

With the pinned runtime selected and build complete:

```sh
npm run exercise
```

Open the printed loopback URL and choose **Open local release exercise**. This opt-in mode creates a **separate generated local workspace**, including its own catalog/ledger and two trusted Node fixture processes. It never uses your normal operator data. **Dev Sandbox — Development** and **Test Sandbox — Test** are concrete destinations with distinct stable instance IDs; Production cannot be selected. The two bundled sample versions are data payloads, not Observatory builds or executable candidate code.

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

Step A is accepted and [merged in its separate repository](https://github.com/bobrs/observatory-hello-reference/pull/1). This branch implements the separately authorized Step B, submitted for PM review and separate Sponsor merge authorization.

```sh
npm ci
npm run verify
AO_PORT=0 npm run reference
```

Open the printed URL, then **Open three reference destinations**. The opt-in mode uses the same Node/TypeScript/Fastify/SQLite stack and native HTML forms. No new dependencies, migration, hosting tools or browser JavaScript are required. The normal self-catalog remains read-only and its real operational state stays unknown. The previous `npm run exercise` data-fixture mode and history keep their original meaning.

The controller creates a separate generated local workspace, retains verified copies of the [three accepted independent app packages](fixtures/reference/README.md), and starts three owned processes with distinct destination/instance IDs, runtime directories and loopback endpoints:

| Destination | Stage | Initial package |
| --- | --- | --- |
| Dev Reference | Development | 1.2.0 |
| Test Reference | Test | 1.1.0 |
| Demo Production | Production — **DISPOSABLE DEMO ONLY, NOT REAL PRODUCTION** | 1.0.0 |

1. **Refresh observations** reads all three actual `/version` endpoints, separately, with a bounded timeout for each. Initially no observations are invented from startup. Open any app to see its own bold baked version.
2. Select **1.2.0 → Test Reference**, review readiness, enter a self-declared name/role and record the exact bounded demo authorization. Click **Upgrade to 1.2.0** separately. The old process stops and the verified selected package starts in a new process; brief unavailability is expected.
3. The receipt is execution evidence only. Click **Observe target** or return and **Refresh observations**. Test now reports 1.2.0; Development and demo-Production remain unchanged.
4. Select **1.1.0 → Test Reference**, record a fresh decision and explicitly **Rollback to 1.1.0**. It starts the original retained package, never rebuilds an old version label or rewrites history. Refresh and open the actual Test app to check the result.

The three cards prioritize observed version, time/source, short artifact identity and **Open app**. Evidence disclosures retain full digests, separate HTTP response hashes, instance/boot identities, decision/request hashes and timelines. A changing response hash is not the immutable whole-package digest. Freshness is evaluated when rendering; an idle page does not auto-poll. After five minutes or a runtime change, refresh is required. The endpoint is a same-host runtime report validated against the accepted mapping and owned context, not hostile-host attestation, health or independent Test acceptance.

Under **Demonstration faults**, refusal leaves the old app intact; startup failure stops the old app and leaves that destination unavailable; withheld receipt really starts the package but records an unknown execution outcome. A later matching observation does not rewrite the unknown receipt. Stale requests, expired decisions and consumed requests cannot dispatch again. A failed refresh makes current state unavailable and labels the last-known version/time historical without erasing the other two observations.

Use Ctrl-C and wait for the controller and all its owned children to exit. The printed workspace is retained as disposable evidence. To explicitly resume that marked reference workspace, set `AO_REFERENCE_DIR` to its exact absolute path before `npm run reference`. One controller may own it. Resume creates fresh boots from each destination's last successfully retained selection (or its initial selection), **not continuous runtime or replay of an old request**. A startup failure therefore needs this explicit stop/resume or a new workspace; there is no automatic recovery/rollback. Earlier authorizations become stale, missing terminal receipts recover as unknown and all old observations remain historical until refreshed. There is no arbitrary endpoint/path/command input, remote control, real Production, registry, adapter platform, CI or external deployment.

`npm run demo:reference` runs the browser walkthrough and writes source-stamped desktop/mobile screenshots and a report into ignored `test-results/reference/`; `npm run demo` and `npm run demo:exercise` check the accepted earlier surfaces. All use disposable data and owned processes. [Committed Step B evidence and screenshots](docs/evidence/ao-inc-003b/README.md) identify the clean implementation source; the PR records the exact final tested head. Only macOS arm64/Chromium is exercised here; no independent Test reviewer is designated.

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

Current implementation review is [AO-INC-003 / Issue #7](https://github.com/bobrs/Application-Observatory/issues/7). The accepted earlier fixture gate is [AO-INC-002 / Issue #5](https://github.com/bobrs/Application-Observatory/issues/5). [AO-INC-001 / Issue #3](https://github.com/bobrs/Application-Observatory/issues/3) records the accepted self-catalog, and [AO-GATE-001 / Issue #1](https://github.com/bobrs/Application-Observatory/issues/1) retains the continuity deliberation. Read [DECISIONS](docs/DECISIONS.md) for provenance and bounded Sponsor instructions, and [GATES_AND_ROLES](docs/GATES_AND_ROLES.md) for the handoff convention. The initial [CODEX_INTAKE](docs/CODEX_INTAKE.md) remains available as provenance.

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

[PR #6](https://github.com/bobrs/Application-Observatory/pull/6) merged AO-INC-002 as `bbe838c366bbd33f759fb6074a2b20993dae152a`. Step A reference PR #1 merged as `da5731368d49c0426fd57a52588ff3db3e4a69e2`. The Sponsor directly authorized bounded **AO-INC-003B** development in the Dev session; [Issue #7 continuity](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662) and [DECISIONS](docs/DECISIONS.md) record attribution and exclusions. This Step B branch awaits PM review and separate Sponsor merge authorization. No real Production, external deployment, health or independent Test acceptance is established.
