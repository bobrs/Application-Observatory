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

## 2026-10-28 — Self-catalog accepted; AO-INC-002 fixture-only control authorized

- **Prior gate:** [PR #4](https://github.com/bobrs/Application-Observatory/pull/4) merged as [`f19a0ac2758a4d59709c06fbf5d75d9611b46545`](https://github.com/bobrs/Application-Observatory/commit/f19a0ac2758a4d59709c06fbf5d75d9611b46545). [Issue #3 completion](https://github.com/bobrs/Application-Observatory/issues/3#issuecomment-6482136137) separates Dev validation, PM acceptance, Sponsor-reported successful local run/visual acceptance, direct merge authorization and actual merge; the Issue is closed. It supersedes the earlier pending-merge state for AO-INC-001, without asserting independent Test acceptance.
- **Planning sources:** [Dev recommendation](https://github.com/bobrs/Application-Observatory/issues/5#issuecomment-6482252116) and [PM refinement](https://github.com/bobrs/Application-Observatory/issues/5#issuecomment-6482296963). Approach A is accepted for this build, with different stages: Dev Sandbox / Development and Test Sandbox / Test, not the original two-Test illustration.
- **Authorization/provenance:** the Product Sponsor directly stated in the Dev session: "I authorize **AO-INC-002**, limited to the local version-to-environment release exercise recommended by Dev and refined by PM." This is Dev's transcription without a public source permalink, not a separately authenticated Sponsor GitHub statement. It supersedes Issue #5's historical planning-only status for this exact bounded build.
- **Scope:** branch `feat/version-environment-demo` from verified main above; two bundled data-only versions, two disposable fixed local Node target instances, server-rendered select/review/decision/apply/observe journey, minimal migration/ledger, tests and screenshots. No new stack or generic workflow engine. Activation changes fixture-served bytes only; a separate HTTP reader hashes actual responses. Stable target IDs and fresh boot IDs prevent reuse across incarnations.
- **Conditions:** explicit opt-in and separate generated workspace; default catalog remains read-only. Five-minute request/observation/authorization limit; exact digest, destination and expected generation; single-use dispatch; preserved refusal, receipt and observation history. Unknown outcomes cannot automatically retry; restart retains uncertain attempts for explicit read-back. Failure scenarios are labeled injected demonstrations.
- **Explicit exception:** the initial record-only boundary is revised only for this local fixture action. This does not authorize real deployments or the whole earlier Increments 2–3. No arbitrary commands, endpoints, target paths, integrations, CI, privileged operations or GhostSentry3 access.
- **Stop point:** commit/push and open a PR with exact tested revision, evidence and limitations; await PM review and separate Sponsor merge authorization. No merge is authorized by this build instruction.

## 2026-10-29 UTC — Step A accepted/merged; AO-INC-003B authorized

- **Accepted bases:** Observatory [PR #6](https://github.com/bobrs/Application-Observatory/pull/6) main `bbe838c366bbd33f759fb6074a2b20993dae152a`; separately authorized public CC0 [reference app PR #1](https://github.com/bobrs/observatory-hello-reference/pull/1), reviewed head `982aeb68451a8044a00c15a7f079861ac53e31bb`, merged as `da5731368d49c0426fd57a52588ff3db3e4a69e2` with the identical tree. [PM content acceptance](https://github.com/bobrs/observatory-hello-reference/pull/1#issuecomment-6485558962) did not independently execute Dev checks. Sponsor reported local visual acceptance; [fresh Dev validation](https://github.com/bobrs/observatory-hello-reference/pull/1#issuecomment-6485714367) preceded normal head-guarded merge.
- **Authority/provenance:** Sponsor directly stated in the Codex session, “Step A is accepted for merge. and Step B authorized for development”. [Dev continuity and bounded implementation proposal](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662) transcribes it without a public session permalink. Role statements through the shared GitHub account are attributed, not separately authenticated identities. This supersedes historical Step-B-not-authorized wording for this exact build only, following the [Dev plan](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485115867) and [PM refinements](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485169603).
- **Bounded work:** branch `feat/reference-version-observation` from verified Observatory main above. One opt-in reference mode; only three known independent portable packages, accepted digests pinned outside candidates and verified before execution. Three separate owned local processes/directories/endpoints: Development 1.2.0, Test 1.1.0, Production 1.0.0 **DISPOSABLE DEMO ONLY**. Concise observed-version cards, Open app, explicit version/destination review, exact-request five-minute self-declared decision, apply, separate HTTP refresh, genuine upgrade and retained-package rollback. Existing ledger reused in a separate marked workspace; no schema or dependency addition.
- **Evidence semantics:** complete package identity is distinct from Git revision, HTTP response hash, launch receipt, runtime self-report, boot/context, organizational authority, health and Test acceptance. Pre-execution trusted verification supplements the fresh same-host HTTP witness; it is not hostile-host attestation. Old fixture hashes continue to mean data-payload bytes. Normal self-entry metadata and unknown real operational state remain unchanged.
- **Recovery:** no automatic retry/rollback. Explicit resume starts fresh processes from last retained selections, records new boots, invalidates old authorizations and keeps missing receipts unknown; it is not continuous runtime or a replay of prior operations. Failed/unavailable observations preserve explicitly historical last-known evidence. Same-user malicious interference and cross-platform validation remain limitations.
- **Review stop:** commit/push and open an unmerged PR with exact tested head, commands/results and screenshots. No CI, arbitrary intake/adapters, external deployment, real Production, privileged actions or unrelated project/GhostSentry3 access. PM review and separate Sponsor merge authorization remain required; no independent Test acceptance is asserted.

## 2026-10-29 UTC — Step B merged; AO-INC-004 first layout authorized

- **Prior outcome:** [PR #8](https://github.com/bobrs/Application-Observatory/pull/8) merged reviewed head `92456606e96ea961de41468e6fc83856754744ae` as main `dcb893848b28caecf5dd0c3535a9f4872c4ac029`, with identical tree. [Fresh Dev verification](https://github.com/bobrs/Application-Observatory/pull/8#issuecomment-6487095644), [PM content acceptance](https://github.com/bobrs/Application-Observatory/pull/8#issuecomment-6486111049) and [Issue #7 completion](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6487105707) distinguish evidence, acceptance, Sponsor instruction and actual GitHub merge. No independent Test or additional hands-on acceptance is inferred.
- **Direct authorization:** Sponsor stated in the Codex session, “PR #8 is accepted for merge. Also inspect Issue #9 and begin development”. [Dev intake](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487106032) transcribes this without a public session permalink or separately authenticated role identities. It supersedes Issue #9's earlier design-only restriction only for this bounded first layout; no separate PM design review is invented.
- **Small slice:** branch `feat/executive-portfolio` from the verified main above. Executive portfolio with two separate application definitions; application detail with zero/one/many per-stage presentation, recent activity, scope/role/uncertainty and existing bounded release workflow. Only three existing live reference targets; additional shapes are labeled synthetic design fixtures. [Design/copy and reversal](AO_INC_004_DESIGN.md) accompany implementation. PM's nonblocking consumed-request wording is addressed without weakening reuse checks.
- **Continuity:** preserve original persisted self metadata, source and timestamp; keep old next-step text as historical evidence. Hello is a recognized bundled definition sourced to accepted independent code, not a new DB seed or observation. No schema, dependency, controller/launcher, accepted package, IAM, permission or integration changes. Normal rendering does not probe targets or start reference processes. Suggested next steps are not authorizations; governance standing is not execution capability.
- **Stop:** commit/push an unmerged PR with exact tested source, actual checks, real-versus-synthetic screenshots and limitations. Await PM review and separate Sponsor merge authorization. No CI, external deployment/hosting, new executable destinations, unrelated application or GhostSentry3 access. Design evidence/Dev checks are not independent Test or health acceptance.

## Change practice

New understanding should modify this record transparently. Preserve meaningful objections, deviations, and rationale, especially when changing the project goal or crossing into live deployment authority.

Keep later entries short: date, decision/status, rationale, source links and what is superseded. Retain unresolved questions in the linked Issue; do not duplicate entire conversations here.
