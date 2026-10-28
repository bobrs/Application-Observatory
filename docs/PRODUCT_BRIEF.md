# Product brief — Application Observatory

## Why this exists

Small teams repeatedly ask someone else for status because evidence lives in repositories, CI systems, deployment runtimes, test reports, notes, and individual memories. The Observatory presents a shared, comprehensible **decision surface** rather than trying to own all that work.

It should answer: Where is the application? What version is recorded in each environment? How do we know? What's uncertain? What happened before? What decision is next, and who has standing to make it?

## Guiding invariant

**Mutual intelligibility.** Information from humans, APIs, logs, scrapes, and AI becomes useful when its origin and epistemic limits remain clear and it can be interpreted and challenged by legitimate participants.

Separate:
- **Intent:** why something should exist or change.
- **Claim and observation:** what someone reports or a source measures.
- **Interpretation:** what the evidence might mean.
- **Commitment:** what a responsible actor authorizes.
- **Outcome:** what actually happened.

Authority over a decision is not authority over the meaning of every observation. The portal should make disagreement and missing evidence visible rather than conceal them.

## Initial audience and job

Operators, developers, Test reviewers, Product Sponsors, PMs, and adjacent team members. Most simply need a reliable answer to a status question. Specialists should be able to drill down to evidence without forcing everyone to understand the tools that produced it.

## First two consequential gates

1. **Test uptake:** a Test participant accepts a specific candidate for evaluation, optionally with conditions. This is a commitment to evaluate, not a statement that the software has passed.
2. **Product Sponsor authorization:** an accountable person authorizes a specific evaluated candidate for a defined Production purpose. This is not proof of deployment or runtime health.

These may be recorded as attributed declarations in a local MVP; unauthenticated declarations are not security-grade authorizations.

## Self-observation

The Observatory is its own first catalog entry. As it gains capability to record, query, explain, and assess its lifecycle, it can use that capability on itself. Do not make the portal the sole witness of its own correctness or recovery.

## Boundaries

The Observatory is not a Jira/Atlassian replacement, ERP, CI/CD platform, credential vault, IAM system, or autonomous agent controller. It may eventually **read from or link to** such systems, preserving their authority over their own records.

GhostSentry3 remains separate. The initial demo uses the Observatory itself and explicitly marked fixtures.

## Open-source posture

A public CC0 resource for useful lightweight coordination, not a commitment to commercialization, public hosting, enterprise functionality, or a managed service. Prefer understandable defaults and graceful extension.
