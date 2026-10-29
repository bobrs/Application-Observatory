# Advisory refinement — commitments alongside uncertainty

This addresses the [focused advisory PM review](https://github.com/bobrs/Application-Observatory/pull/12#pullrequestreview-5693184770) on PR #12. The Sponsor directly instructed Dev in the Codex session to inspect that advisory and proceed with refinement or seek clarification; [Dev response](https://github.com/bobrs/Application-Observatory/pull/12#issuecomment-6488750666) transcribes the bounded continuation. No clarification or scope expansion was required. Role statements remain attributed, not separately authenticated GitHub identities; no merge is authorized.

**Clean tested implementation source:** `51350d3362d17ddbabf478f0a4af3e1967a13515`.
**Prior submitted head:** `da83ec22ed8dfe0b4b356a61ded4926dff2368d1`.
**Accepted main:** `64ba416a946d374fcbb9c04da7c42ed593b905b6`.

The earlier compact scan returned uncertainty before considering pending changes. It now composes bounded counts for decisions awaiting action, declared authorizations not yet dispatched, unknown execution and destination uncertainty. Pending signals appear first; uncertainty remains visible. When pending records exist, the next responsible role comes from those records rather than the application's generic suggested role or the approving actor's claimed role. Distinct roles are summarized with a bounded list and remaining count. No health, execution capability or organizational standing is inferred.

Only the portfolio view source changes. Regression tests and the capture script exercise the correction. Pending eligibility/projection, controller, readiness, authorization, routes/POST/CSRF, persistence, packages/verifier/launcher/targets, observation, rollback and dependencies are unchanged from the prior head. No alert engine, new model, integration, permissions, registration, target, framework, CI or deployment was added.

Actual checks on Node 24.22.1 / macOS arm64 / Chromium 156.0.8078.4:

```sh
npm run verify
npm run demo
npm run demo:exercise
npm run demo:reference
npm run demo:portfolio
npm run demo:refinement
```

All PASS on the clean source above: strict TypeScript/build and **37 native tests**, none failed/skipped; five browser workflows with no errors/external requests/overflow. Tests include synthetic Unknown/Stale/Exception plus pending decisions/declarations and unknown execution, actual independently aged Development observation while Test requests remain applicable, and a real unknown receipt on Development coexisting with applicable Test requests. Pending roles remain distinct from generic stewardship and authorizing roles. No request is silently dispatched by the scan.

[Desktop](advisory-mixed-attention-desktop.png) and [mobile](advisory-mixed-attention-mobile.png) show an actual unavailable Development destination beside Test's pending decision and declared authorization. The row keeps all three facts and the pending next actor. These are real owned local disposable targets, not new target registrations. The native stale/unknown-execution cases complement these captures.

Reports: [validation](validation.json), [refinement](refinement-report.json), [default portfolio](demo-report.json), [data fixture](exercise-report.json), [real upgrade/retained rollback](reference-report.json), [variable-count layout](portfolio-report.json). [SHA256SUMS](SHA256SUMS) covers both screenshots and all six JSON reports; run `shasum -a 256 -c SHA256SUMS` in this directory.

The subsequent evidence-only commit adds this record, captures and a pointer without changing executed source/tests/dependencies. The PR records the final tested head and repeat checks. [Original submitted evidence](../README.md) and its hashes remain intact as historical validation; this refinement supersedes its 35-test/current-head statement, not its observations.

Developer-run macOS/Chromium only; no independent Test, PM visual acceptance, health, standing or hostile-host attestation is claimed. Owned test processes and temporary data were cleaned up. No unrelated application or GhostSentry3 was accessed. **Stop for renewed PM review and separate Sponsor merge authorization.**
