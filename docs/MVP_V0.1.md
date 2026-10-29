# MVP v0.1 — first working slice

## Product goal

A read-and-record portal through which a small team sees application state and the next legitimate decision without a status call. Start with one real self-entry; illustrative additional entries must be labeled.

## Surfaces

### Application list
Each entry shows name, purpose, responsible contact or unknown, Development/Test/Production recorded version summary, status source/freshness indicator, and next meaningful decision or 'none recorded'.

### Application detail
Show Development candidates (allow **at least three parallel branches/candidates**), Test recorded candidate, Production recorded candidate; known notes, observations, and recent history. A version label does not imply a unique build; include commit/digest when available. Do not treat each Dev branch as a separate deployed environment.

### Gate review
Choose one exact candidate, source environment, and destination (Dev to Test or Test to Production). Record recommendation, declared approval, change request, or deferral; optional rationale and conditions; reviewer identity and how it was established; date/time and supporting evidence. In the unauthenticated MVP, label as **recorded declaration**, not enforceable production authorization.

### History
Show attributed observations and decisions chronologically. Corrections add information without erasing earlier entries. Contradictions can coexist with their sources and timestamps.

## Non-negotiable semantic distinctions

- **Unknown** is not failed, healthy, approved, or not applicable.
- **Proposed** is not authorized.
- **Reported** is not independently observed.
- **Test passed** is not Product Sponsor approval.
- **Approved** is not executed/deployed.
- **Deployed** is not necessarily healthy or recoverable.
- **Recorded note** is not proof of a reviewer's authenticated standing.

## Acceptance criteria

1. A fresh local instance displays the Observatory's own catalog entry, with honest unknown or not-yet-observed values.
2. Application list and drill-down display Development, Test, and Production, including three simultaneous Dev candidates.
3. Status assertions display source type, source identity/reference, and relevant timestamp; provenance is not hidden.
4. Reviewers can record a decision about an exact candidate's proposed next-stage transition, with conditions/rationale.
5. Decisions persist in a readable history but never silently update deployed version or actual environment status.
6. Correction history and incompatible observations can be inspected without erasure.
7. No privileged host actions, real deployment, production credentials, or live GhostSentry3 access.
8. A fresh operator can run the prototype using documented instructions; targeted automated checks demonstrate key distinctions.
9. Plain-language explanations describe status and uncertainty without relying on colored indicators alone.

## Deliberately out of scope

Idea/proposal inception workflows, provisioning, automated promotion, enterprise IAM, AI evaluation, broad CI/CD integrations, live scraping, monitoring infrastructure, backups/restore integrations, financial analysis, multi-tenancy, Kubernetes, retirement workflows, GhostSentry3 integration.

A future application may adopt many of those; their possibility should not burden the first implementation.

**Later bounded scope decision — AO-INC-002:** [Issue #5](https://github.com/bobrs/Application-Observatory/issues/5) and the Sponsor's direct Dev-session instruction authorize only a disposable local version-to-environment exercise: two bundled data samples, concrete Development and Test destinations, readiness, bounded demo decisions, fixed activation and separate HTTP read-back. This explicitly revises the original record-only boundary for the fixture, while preserving the real self-entry's unknowns and all real-deployment exclusions. See [DECISIONS](DECISIONS.md) for provenance; it is not approval of the full future feature list.

## Scope check

Does the increment make application state, provenance, recent history, or the next human decision more intelligible? If no, record it as a future possibility.

**AO-INC-003B bounded addition:** the Sponsor separately authorized the fixed local bridge in [Issue #7 continuity](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662), as transcribed in [DECISIONS](DECISIONS.md). Only three accepted independently packaged reference artifacts, verified against external pins before execution, and three owned loopback destinations are supported. Production is explicitly **DISPOSABLE DEMO ONLY**. Exact bounded decision, dispatch/receipt and fresh HTTP version observation remain distinct. Existing data-fixture history is not reinterpreted as package identity; the normal real self-catalog remains read-only/unknown. No general deployment framework, real Production, external integration or CI is authorized. Step B's PR must stop for PM review and separate Sponsor merge authorization.
