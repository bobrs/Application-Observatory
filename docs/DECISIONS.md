# Decisions, assumptions and open choices

## PM framing — prepared for Sponsor review

- The prime directive is **mutual intelligibility**, not organizational control.
- The portal aggregates attributed assertions and decisions; external tools retain authority over their own records.
- Public and reusable under CC0; serving real small teams matters more than commercialization.
- The initial catalog includes the Observatory itself; never confuse self-report with independent verification.
- v0.1 displays Development/Test/Production, versions/candidates, provenance and history; Test intake and Production review are useful first gates.
- A recorded review/approval never causes deployment or asserts target health.
- Product inception/proposals have a separate gate logic from release progression; don't build inception workflows yet.
- GhostSentry3 stays completely separate until expressly invited later.
- The technology profile is a suggested convergence path, not a restricted-platform mandate.
- Codex first performs **planning-only** Dev review. Implementation requires Product Sponsor authorization.

## Initial open decisions for the Dev gate to illuminate

Preserved from the initial intake; the dated outcomes below qualify these questions without erasing their origin.

- Minimal local runtime/UI and persistence footprint.
- How to seed the first self-entry, and how sample entries remain clearly illustrative.
- How to record correction history simply.
- Whether v0.1 needs role-aware UI or only accurately labeled manual declarations.
- Minimal stable candidate identity beyond version strings.
- What constitutes a practical demo of Test uptake and sponsor review with no live deployment.

Do not manufacture answers to unresolved choices. Record proposals and evidence as they arise.

## 2026-10-28 — Dev assessment and PM concurrence

- **Source revision:** [`7cc1ecdc5c17ab23cffefcf5609e560a54ac026b`](https://github.com/bobrs/Application-Observatory/commit/7cc1ecdc5c17ab23cffefcf5609e560a54ac026b).
- **Dev result: FEASIBLE, reported.** [Issue #1](https://github.com/bobrs/Application-Observatory/issues/1) preserves the Sponsor-relayed summary of Codex's assessment; it is not an independently authenticated Dev submission.
- **PM result: CONCUR.** [PM gate comment](https://github.com/bobrs/Application-Observatory/issues/1#issuecomment-6480880258), attributed to ChatGPT and relayed through the Sponsor's connected account; no separate GitHub identity or independent Test acceptance is established.
- **Advisory approach:** Node.js 24 LTS, TypeScript, Fastify, server-rendered HTML/CSS and SQLite with `better-sqlite3`; check native binding support before relying on it. The lean Python/Flask/SQLite alternative remains documented in the Issue summary.
- **Delivery plan:** (1) running self-catalog, honest unknowns/basic provenance, persistence and run instructions/checks, without recording forms; (2) parallel Dev candidates, environment assertions, evidence/corrections/history; (3) exact-candidate gate declarations with rationale and conditions. The complete v0.1 spans all three increments.
- **Still unresolved:** implementation authorization; native binding portability; later evidence/candidate/correction details; designation of a Test reviewer before independent acceptance is claimed. Defaults remain local-only operation, manual declarations, explicit unknowns and no GhostSentry3 integration.

## 2026-10-28 — Documentation-only continuity authorization

- **Status/provenance:** Dev transcription of the Product Sponsor's direct instruction in the Dev session on this date; no public message permalink is available. The Sponsor stated: "I authorize **the documentation-only continuity increment**." This report is submitted for PM review and Sponsor merge authorization, not represented as an independently authenticated GitHub Sponsor comment.
- **Bounded scope:** branch `docs/continuity-gates` from latest `origin/main`; minimal edits to `AGENTS.md`, `GATES_AND_ROLES.md`, this record and the README, plus an optional brief `CODEX_INTAKE.md` handoff pointer; commit, push and open a PR targeting `main`, linked to Issue #1.
- **Convention:** Issues for deliberation/authorizations, short-lived branches and PRs for changes, concise durable outcomes in existing documents; preserve sources and corrections. [PM recommendation](https://github.com/bobrs/Application-Observatory/issues/1#issuecomment-6480880258) preceded this bounded Sponsor instruction.
- **Stop point:** do not merge; await PM review and Product Sponsor merge authorization. No application implementation, dependency installation, CI configuration or GhostSentry3 access. **Increment 1: running self-catalog only** remains recommended, not authorized.

## 2026-10-28 — Reported discovery deviation and safeguard

[Issue #1](https://github.com/bobrs/Application-Observatory/issues/1) records Codex's disclosure that earlier read-only discovery included filename/text searches and a Git-remote read touching GhostSentry3 before the restriction was recognized. No modifications or service access were reported; the subsequent isolated clone/continuity assignment reported no GhostSentry3 access.

The safeguard is to verify this repository's root and remote before each task, use an explicit repository working directory, and bound discovery to this project. Do not inspect neighboring projects, follow external symlinks or broaden discovery when context is missing. Report the missing context instead. This is procedural discipline, not filesystem isolation, and the deviation grants no future access permission.

## 2026-10-28 — Continuity merged; AO-INC-001 authorized for implementation

- **Prior gate completed:** [PR #2](https://github.com/bobrs/Application-Observatory/pull/2) merged as [`3e5ee4925540c300a9b1ae9bdc267254ea644a7a`](https://github.com/bobrs/Application-Observatory/commit/3e5ee4925540c300a9b1ae9bdc267254ea644a7a). [Issue #1 outcome](https://github.com/bobrs/Application-Observatory/issues/1#issuecomment-6481151297) distinguishes Dev evidence, PM acceptance, in-session Sponsor merge authorization and the actual merge. This supersedes the earlier pending-merge stop point for that documentation increment.
- **Authorization/provenance:** in the Dev session on this date, the Product Sponsor directly stated: "I authorize **AO-INC-001: running local self-catalog**, within the scope and exclusions defined in Issue #3." This is Dev's transcription with no public source permalink, not a separately authenticated Sponsor GitHub statement. It supersedes the earlier "not authorized" state for Increment 1 and the proposal-only wording in [Issue #3](https://github.com/bobrs/Application-Observatory/issues/3).
- **Bounded work:** `feat/self-catalog` from the verified merge above; implement one seeded self-entry, read-only list/detail, honest environment unknowns and provenance, local SQLite persistence/migration, run instructions and targeted checks/screenshots. Local project dependencies, builds, tests and disposable fixtures are allowed. Use the recommended Node.js 24 / TypeScript / Fastify / server-rendered HTML/CSS / `better-sqlite3` stack; no frontend framework is needed.
- **Record semantics:** seed project metadata from the baseline brief and README with an immutable source reference and first-recorded time. Seed the next review step from Issue #3 as a snapshot. No environment observation is inferred from this metadata or from starting the catalog. Repeated startup preserves existing records.
- **Operations:** one unprivileged loopback-bound process; data outside source/synchronized storage; migration 001 and documented stopped-database backup/restore procedure. Tests and screenshots use separately disposable data.
- **Stop point:** commit, push and open a PR with exact tested revision/evidence; await PM review and separate Sponsor merge authorization. No CI, external deployment, GhostSentry3 access, candidate tracking/editing/history or gate controls. Increments 2 and 3 remain unauthorized. Developer tests are not independent Test acceptance.

## Change practice

New understanding should modify this record transparently. Preserve meaningful objections, deviations, and rationale, especially when changing the project goal or crossing into live deployment authority.

Keep later entries short: date, decision/status, rationale, source links and what is superseded. Retain unresolved questions in the linked Issue; do not duplicate entire conversations here.
