# AO-X01 — External observation seam: review checklist (design only)

**Status:** reviewable questions and boundaries, not an accepted adapter/API, implementation authorization or evidence that a remote destination exists. Linked to [Issue #14](https://github.com/bobrs/Application-Observatory/issues/14). The Application Observatory is a decision/evidence projection, not a deployment controller.

## Purpose of the first external read model

When a separate managed Test destination is eventually demonstrated, expose the smallest read-only evidence record that lets the Observatory distinguish:

- **Desired:** version/digest requested for a destination (intent, not proof of delivery).
- **Dispatched:** attributed, source-stamped task attempt with correlation ID and terminal/unknown result (task receipt, not proof of a running version).
- **Observed:** independently initiated version/health read-back from the exact destination identity/incarnation, with collection time, method, response and uncertainty.
- **Disputed or unknown:** missing receipts, network failure, stale observation, contradictory /version, digest mismatch, or unreachable destination. Never silently imply success.
- **Reversed:** explicit restore attempt of a retained immutable candidate followed by new independent observation, not reuse of an old observation.

## Questions the later implementation must resolve

1. **Destination identity:** which stable ID, instance/target incarnation, environment designation and access boundary identify the observed Test endpoint?
2. **Artifact identity:** how does a separately accepted digest enter the view, without trusting version strings as proof?
3. **Evidence provenance:** how are source and collection time represented for every statement, particularly when observer and deployer differ?
4. **Freshness:** what age or failure mode renders a previous result stale or unknown?
5. **Contradictions:** how does UI display a successful dispatch receipt alongside a contradictory actual /version response?
6. **Security:** what least-privilege read interface exposes observations without placing operational credentials in the UI?
7. **Testability:** what synthetic fixtures are helpful before a real managed target exists, and which independent Test gate proves an eventual integration?

## Acceptance and next gate

This file intentionally contains no network adapter, schema migration, client credential, dispatcher, endpoint, simulated claim of external success or host action. Synthetic fixtures may help presentation design but are not independent external runtime evidence.

The next authorized act in Issue #14 is a read-only review and clarification of these questions, cross-checked against the currently accepted Observatory destination/read-model behavior. Implementation waits for a separately demonstrated real observation contract and a bounded Sponsor gate.

The PR carrying this document also supplies a narrow review surface for testing GitHub-review-triggered read-only agent triage. A submitted PR review is steering data, not itself authorization for implementation or host operations. Ordinary conversation comments are not events in this pilot.

**Handoff:** cite exact verified source commit and Issue/PR state; distinguish code facts, design assumptions and unknowns; name next Sponsor decision. GhostSentry3 and unrelated host resources remain excluded.
