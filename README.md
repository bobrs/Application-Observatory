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

On startup, migration **001** creates the catalog table transactionally and records SQLite `user_version=1`. A newer schema causes startup to fail rather than downgrade it. The self-entry is inserted only when absent; restarting neither duplicates it nor overwrites its metadata or original timestamp. There are no stored operational observations in this increment, so all environment states remain explicitly unknown.

For a basic backup, stop the app and wait for exit, then copy `catalog.sqlite` to a separate local backup location. To check a restore, copy that backup into a new local data directory and start with `AO_DATA_DIR` pointing to it. Confirm the self-entry and original timestamp before using the restored copy. Do not copy a live database, overwrite your original data, or infer recoverability from a successful start. There is no automated backup integration.

### Developer checks and UI evidence

`npm run verify` type-checks, builds and runs Node tests. All tests use separately created temporary directories and remove them afterward; none use operator data. Checks include repeated seed, persistence across an actual server-process restart, explicit unknowns/provenance, read-only HTTP behavior and safe rendering. Tests require the compiled output; run `npm run build` before invoking `npm test` alone.

Optional browser demo (macOS/Linux shell):

```sh
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright npx playwright install chromium
npm run build
npm run demo
```

This installs a project-local browser, launches a disposable loopback instance, checks navigation and desktop/mobile layouts, and writes four screenshots plus `demo.json` to ignored `test-results/demo/`. It closes the browser/server and removes its data fixture. The report records the source commit and dirty state, environment, browser version and observed results. Review evidence is linked from the increment PR. Developer evidence is not independent Test acceptance; the native SQLite binding still needs checking on platforms other than those actually tested.

## Prime directive: mutual intelligibility

Every consequential assertion about an application's state, purpose, readiness, or future should be intelligible, attributable, grounded, and open to correction.

Manual entries, APIs, scrapes, CI results, and AI interpretations are welcome when source, time, scope, and limits are visible. A claim is not verification. An approval is not a deployment. A deployment is not proof of health.

## First development target: v0.1

The full target spans three separately authorized increments. AO-INC-001 implements the read-only self-catalog subset; the remaining features below are future scope.

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

Current implementation review is [AO-INC-001 / Issue #3](https://github.com/bobrs/Application-Observatory/issues/3). [AO-GATE-001 / Issue #1](https://github.com/bobrs/Application-Observatory/issues/1) records the earlier continuity deliberation. Read [DECISIONS](docs/DECISIONS.md) for provenance and bounded Sponsor instructions, and [GATES_AND_ROLES](docs/GATES_AND_ROLES.md) for the Issue/branch/PR handoff convention. The initial [CODEX_INTAKE](docs/CODEX_INTAKE.md) remains available as provenance.

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

The Product Sponsor directly authorized **AO-INC-001: running local self-catalog** in the Dev session, within Issue #3's scope; [DECISIONS](docs/DECISIONS.md) records this as a Dev transcription. This branch supplies that local read-only increment for PM review. Separate Sponsor authorization is required to merge. No independent Test acceptance, Production authorization, deployment or runtime health is established. Increments 2 and 3 remain outside scope.
