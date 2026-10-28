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

## Change practice

New understanding should modify this record transparently. Preserve meaningful objections, deviations, and rationale, especially when changing the project goal or crossing into live deployment authority.

Keep later entries short: date, decision/status, rationale, source links and what is superseded. Retain unresolved questions in the linked Issue; do not duplicate entire conversations here.
