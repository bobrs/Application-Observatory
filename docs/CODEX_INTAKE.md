# Codex intake — initial Dev gate (planning only)

This initial assignment is preserved as provenance. For the current handoff, read [DECISIONS](DECISIONS.md), [GATES_AND_ROLES](GATES_AND_ROLES.md), and [Issue #1](https://github.com/bobrs/Application-Observatory/issues/1), including its gate comments. Only the documentation continuity increment is authorized; Increment 1 implementation remains unauthorized.

## Assignment

You are the Dev gate. ChatGPT serves as the PM gate for interpretation and scope. The repository owner is Product Sponsor and gopher. The documents are proposals and constraints, not an immutable architecture.

Read: README.md, AGENTS.md, docs/PRODUCT_BRIEF.md, docs/MVP_V0.1.md, docs/GATES_AND_ROLES.md, docs/PREFERRED_STACK.md, docs/DECISIONS.md, and standards/technology-preferences.yaml.

## Immediate task — stop before implementation

Deliver a concise Dev-gate assessment:

1. **Feasibility:** can the acceptance criteria be met in a small self-contained first slice?
2. **Minimal stack:** recommend the smallest adequate familiar stack and one lean alternative; justify deviations.
3. **Data/behavior distinctions:** what must be represented to distinguish a recorded approval from observed deployment and a claim from verified evidence?
4. **Development increments:** propose a sequence yielding a running self-catalog, environment status, then recorded promotion decisions/history.
5. **Evidence:** tests and demo flows for unknown state, multiple Dev branches, corrections, provenance, and exact-candidate decisions.
6. **Operations:** local run mode, persistence, basic migration/backup approach, access constraints, and independence from GhostSentry3.
7. **Risks and choices:** only decisions the Sponsor must actually make; suggest defaults for deferrable ones.
8. **Verdict:** FEASIBLE, FEASIBLE_WITH_EXCEPTIONS, or NEEDS_REVISION, with the smallest recommended coding authorization.

**Stop for PM/Sponsor deliberation.** Do not implement, scaffold, create CI, install tools on hosts, configure real credentials, or access GhostSentry3 during this gate.

## If later authorized

Implement only the specifically approved increment, use disposable fixtures, report actual test results and unexpected effects, and keep production deployment distinct from recorded approval. Codex acting as developer is not independent Test acceptance.

## Success criterion

Someone who did not develop an application can inspect its recorded lifecycle status and next decision without calling the developer. The Observatory itself is the first catalog entry.
