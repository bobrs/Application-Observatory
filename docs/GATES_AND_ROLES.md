# Gates, roles, and evidence

## Deliberation responsibilities

| Gate | Current participant | Meaning |
| --- | --- | --- |
| PM | ChatGPT | Challenge meaning, scope, acceptance and consequences; advisory |
| Dev | Codex | Challenge feasibility, technical paths, and implementation evidence; advisory until authorized |
| Sponsor | Repository owner | Authorize scope and consequential operational actions |
| Test | Designated reviewer, to be chosen | Accept evaluation responsibility, record results and limitations |
| Operational witness | External source/tool, future | Report deployed artifact and runtime observations |

The Sponsor may cover multiple responsibilities in a tiny demo; do **not** present that as independent review. Tests run by Codex do not automatically constitute independent Test approval.

## Lightweight GitHub continuity

- **Issues:** deliberate scope, gate results, questions and bounded Sponsor authorizations. Start with [AO-GATE-001 / Issue #1](https://github.com/bobrs/Application-Observatory/issues/1); split only when a distinct task needs its own decision.
- **Branches and PRs:** one reviewable increment per short-lived branch from the latest verified upstream/base branch (`origin/main` in the canonical checkout). A fork's `origin` may differ; verify the intended canonical upstream and target base, and stop if ambiguous without broadening filesystem discovery. Link its Issue. The target base (`main` here) is the accepted baseline; no direct commits in normal development. Merge requires Sponsor authorization and appropriate review. Approval to prepare a PR does not authorize its merge or deployment.
- **Repository documents:** keep concise durable outcomes, rationale and source links in `DECISIONS.md`; stable conduct here and in `AGENTS.md`; current status and active-work links in the README. Leave detailed deliberation in the Issue. No board, automation or separate decision-file system is required.

A gate comment needs: role and reporting provenance; exact source revision or proposal reference; disposition and bounded scope; rationale/evidence and limitations; unresolved questions; next responsible actor and stop point. Use full commit SHAs and specific comment links when available.

Sponsor authorization must name the task/proposal, permitted actions, exclusions and review/stop point. A direct Sponsor instruction in-session can authorize work; carry its date, source type and bounded wording into the handoff without requiring duplicate approval. A Dev transcription is a report of that instruction, not a separately authenticated Sponsor GitHub statement. Role labels posted through a shared account do not establish independent identities.

Correct consequential records with a new linked comment or dated decision entry. Preserve prior meaning, disagreements and provenance; identify what is superseded. Do not silently promote a proposal or relayed statement into an accepted decision.

For each later implementation handoff, record the repository/PR, full tested commit SHA, clean/dirty checkout status, OS/runtime versions, setup/fixtures, exact commands, observed results and limitations. Link screenshots/logs to that revision. Use commit-based file permalinks; a branch name, local path or localhost URL alone is insufficient for remote PM review. Publish the tested source when authorized; unpushed results remain unavailable for remote source inspection. A later evidence-only commit may reference the tested source commit. Relevant source changes require refreshed checks. Developer evidence remains distinct from independent Test acceptance.

Keep public Issues, commits, PRs, attachments and logs free of personal paths, credentials, tokens, live customer data and private operational details.

## Separate lifecycles

**Proposal inception:** Someone proposes a capability; DevSecOps describes supported boundaries; an authorized sponsor permits bounded pursuit. This is conceptually important but **not part of v0.1**.

**Software progression:** A concrete candidate is offered for Test; Test accepts/evaluates with conditions and evidence; sponsor may authorize a named candidate for Production; a separate operator/tool deploys; independent evidence can then establish what actually runs.

A gate asks whether the available evidence justifies a **particular next commitment**. Criteria vary by risk and context; don't force inception into the exact deployment checklist.

## Necessary terms

| Term | Meaning |
| --- | --- |
| Proposed | Someone expresses an intended candidate or action |
| Reported | An identified source asserts a state |
| Observed | A source directly inspected a state at a known time |
| Verified | Criteria were applied to evidence; identify which criteria |
| Recommended | Nonbinding opinion to advance |
| Authorized | Legitimately accountable actor approves bounded action; strong authentication required for real authority |
| Executed | Action actually attempted or performed |
| Healthy | Particular health checks passed; not equivalent to deployment |

A decision record should name the application, exact candidate/artifact when known, source and destination, disposition, conditions, rationale, claimant/reviewer, identity provenance, time and relevant evidence.

Do not overwrite contradicted history; record the correction and preserve the earlier entry.

## MVP boundary

For now, the portal records statements and review decisions. It does **not** enforce standing, hold credentials, move artifacts, or update Production. A button that records a declared approval must not imply that a deployment happened.

**AO-INC-002 bounded exception:** the Sponsor authorized an opt-in disposable local release exercise in [Issue #5](https://github.com/bobrs/Application-Observatory/issues/5), as transcribed in [DECISIONS](DECISIONS.md). Only its two bundled data payloads may be activated on its fixed Development/Test fixture instances. A one-shot self-declared demo authorization is separate from dispatch, adapter receipt and fresh HTTP observation. It establishes neither organizational standing, real deployment, Test acceptance nor health. Normal self-catalog operation remains read-only. This exception does not authorize a general deployment framework or the remaining earlier increments.

**AO-INC-003B bounded addition:** the Sponsor separately authorized the fixed local bridge in [Issue #7 continuity](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662), as transcribed in [DECISIONS](DECISIONS.md). Only three accepted independently packaged reference artifacts, verified against external pins before execution, and three owned loopback destinations are supported. Production is explicitly **DISPOSABLE DEMO ONLY**. Exact bounded decision, dispatch/receipt and fresh HTTP version observation remain distinct. Existing data-fixture history is not reinterpreted as package identity; the normal real self-catalog remains read-only/unknown. No general deployment framework, real Production, external integration or CI is authorized. Step B's PR must stop for PM review and separate Sponsor merge authorization.

**AO-INC-004 first layout:** the Sponsor directly authorized beginning Issue #9 development, as transcribed in [Dev intake](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487106032) and [DECISIONS](DECISIONS.md). [The bounded design](AO_INC_004_DESIGN.md) makes the executive portfolio primary and moves all operations behind application drill-down, with Hello as a separate recognized definition. Variable-count stage presentation does not add executable targets. Preserve historical seeds, unknowns, distinct decision/action/observation evidence and fixed local execution safeguards. No schema/IAM/permission/integration/deployment changes; stop at an unmerged PR for PM review and separate Sponsor authorization.
