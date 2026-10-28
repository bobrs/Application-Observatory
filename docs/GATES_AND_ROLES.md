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
