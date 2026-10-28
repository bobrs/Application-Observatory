# Application Observatory

**A lightweight, self-observing application lifecycle portal.**

Application Observatory helps small and mid-market teams understand where software stands, what evidence supports its status, and who can move it forward—without another round of status calls.

This is a **public, CC0 collaborative experiment**, primarily intended as a useful surface for teams rather than a commercial product. It starts by registering **itself** as its first application.

## Prime directive: mutual intelligibility

Every consequential assertion about an application's state, purpose, readiness, or future should be intelligible, attributable, grounded, and open to correction.

Manual entries, APIs, scrapes, CI results, and AI interpretations are welcome when source, time, scope, and limits are visible. A claim is not verification. An approval is not a deployment. A deployment is not proof of health.

## First development target: v0.1

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

Current deliberation is [AO-GATE-001 / Issue #1](https://github.com/bobrs/Application-Observatory/issues/1). Read [DECISIONS](docs/DECISIONS.md) for the reported Dev assessment, PM concurrence and bounded Sponsor authorization, and [GATES_AND_ROLES](docs/GATES_AND_ROLES.md) for the Issue/branch/PR handoff convention. The initial [CODEX_INTAKE](docs/CODEX_INTAKE.md) remains available as provenance.

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

Dev feasibility is **FEASIBLE (Sponsor-relayed report)**; [PM concurs](https://github.com/bobrs/Application-Observatory/issues/1#issuecomment-6480880258). The Sponsor authorized the documentation-only continuity branch and PR in the Dev session, as transcribed in [DECISIONS](docs/DECISIONS.md); PM review and Sponsor merge authorization remain pending. **Increment 1 implementation is not authorized.** The portal is not running, and no Test or Production acceptance has occurred.
