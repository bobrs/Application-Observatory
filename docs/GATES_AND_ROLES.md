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
