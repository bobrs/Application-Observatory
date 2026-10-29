# Guidance for coding agents

Read README.md, docs/PRODUCT_BRIEF.md, docs/MVP_V0.1.md, docs/GATES_AND_ROLES.md, docs/PREFERRED_STACK.md, and docs/DECISIONS.md before proposing implementation.

## Repository boundary and continuity

- Before each task, verify the repository root, configured remote(s), intended canonical upstream and base branch, current branch, commit and working-tree status. This project's canonical repository is `https://github.com/bobrs/Application-Observatory.git`; a fork's `origin` may differ. Use the appropriate verified upstream/baseline without broadening filesystem discovery; stop if the intended target is ambiguous. Run commands with this repository as the explicit working directory.
- Read current decisions and the linked active Issue, including gate comments and Sponsor scope authorization. Do not infer authorization from a recommendation, PM concurrence, or a closed Issue.
- Scope searches and tool requests to this repository. Do not search parent directories, neighboring projects, unrelated services, or follow symlinks outside the repository. If context is missing, report it instead of broadening discovery.
- Use a short-lived branch from the latest verified upstream/base branch (`origin/main` in the canonical checkout) and a PR for reviewable changes; do not commit directly to the accepted base branch in normal development. Merge only after Sponsor authorization and appropriate review.
- Follow the compact handoff convention in [GATES_AND_ROLES](docs/GATES_AND_ROLES.md). Keep public records free of personal paths, credentials, tokens, customer data and private operational details.

## Authorization boundary

Consult the latest attributable, bounded Product Sponsor authorization before acting; do not infer permission from PM or Dev concurrence. Current state and historical provenance belong in the linked active Issue, [DECISIONS](docs/DECISIONS.md) and README. [Issue #1](https://github.com/bobrs/Application-Observatory/issues/1) records the initial Dev assessment and PM concurrence.

Act as the **Dev gate**. Review feasibility, propose the smallest adequate implementation, identify risks and exceptions, suggest verification, and stop. Do not scaffold, install, deploy, change systems, create credentials, or implement code until the Product Sponsor explicitly authorizes a bounded next step.

The preferred-stack profile is advisory. Challenge it when justified. Focus on the smallest useful self-observing portal, not a full enterprise platform.

## Current bounded build

AO-INC-003B was accepted and merged as `dcb893848b28caecf5dd0c3535a9f4872c4ac029`. The Sponsor directly authorized beginning **AO-INC-004 / Issue #9** development; [Dev intake](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487106032) transcribes that instruction and supersedes the issue's earlier design-only restriction for the first layout slice. Read [the design](docs/AO_INC_004_DESIGN.md). Scope: executive portfolio → separate application detail → existing release controls/evidence; generalized presentation collections with synthetic layout examples; no new executable destinations, catalog/schema changes, dependencies, IAM, permission changes, integrations, CI or deployment. Keep original seeds/history and the three fixed trusted reference execution boundaries intact. Stop at an unmerged feature PR for PM and separate Sponsor merge review. Discovery stays in this repository; the accepted reference packages/provenance are already bundled. No unrelated projects or GhostSentry3 access.
## If authorized to implement

- Distinguish source claims, observed state, test evidence, recommendations, authorizations, execution, and health.
- Bind decisions to exact candidates and destinations; never infer deployment from approval.
- Preserve prior assertions when correcting information.
- Mark unknowns rather than synthesizing reassuring statuses.
- Keep credentials and privileged infrastructure actions outside the MVP.
- Use isolated fixtures, local/disposable environments and least-privilege defaults.
- Do not read, modify, monitor, or integrate GhostSentry3, its data or running services without separate explicit authorization.
- Stop on unexpected effects or unmet preconditions; report evidence and alternatives.
- Provide repeatable test instructions and observed results; avoid claiming independent Test acceptance from self-executed tests.
- Keep changes small, reviewable, and aligned to approved scope.

Product Sponsor holds binding authorization; ChatGPT is PM review; Codex is Dev review. They may disagree. Record disputes and remaining uncertainties instead of silently deciding for others.
