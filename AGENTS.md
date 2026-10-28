# Guidance for coding agents

Read README.md, docs/PRODUCT_BRIEF.md, docs/MVP_V0.1.md, docs/GATES_AND_ROLES.md, docs/PREFERRED_STACK.md, and docs/DECISIONS.md before proposing implementation.

## Initial authorized work: assessment only

Act as the **Dev gate**. Review feasibility, propose the smallest adequate implementation, identify risks and exceptions, suggest verification, and stop. Do not scaffold, install, deploy, change systems, create credentials, or implement code until the Product Sponsor explicitly authorizes a bounded next step.

The preferred-stack profile is advisory. Challenge it when justified. Focus on the smallest useful self-observing portal, not a full enterprise platform.

## If later authorized to implement

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
