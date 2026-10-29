# AO-INC-003B developer evidence

Captured from **clean implementation source `1522033d21d890bfa418db2c60a6423c1cae74da`**, based on accepted Observatory main `bbe838c366bbd33f759fb6074a2b20993dae152a`. This later commit adds only this evidence and a README pointer; the PR supplies its final tested head. No application, script, fixture, test or dependency changes occur in the evidence commit.

The separately accepted reference app is reviewed head `982aeb68451a8044a00c15a7f079861ac53e31bb`, merged at `da5731368d49c0426fd57a52588ff3db3e4a69e2`. [Package provenance and exact accepted digests](../../../fixtures/reference/README.md). This demo copies those packages without rebuilding or downloading code, verifies against pins outside each candidate before execution, and uses fresh loopback `/version` observations afterward.

Run from the repository with Node 24.22.1 / npm 11.13.0:

```sh
npm ci --no-fund
npm run verify
npm run demo
npm run demo:exercise
npm run demo:reference
git diff --check origin/main...HEAD
```

Actual results: dependency installation PASS; strict TypeScript/build PASS; **28 native tests passed, none failed or skipped**; all three browser workflows PASS on macOS arm64 / Chromium 156.0.8078.4. The project-local browser/runtime were already installed in ignored caches. Browser setup is in the root README. No CI or external deployment was configured. Generated fixtures and owned processes are closed/removed after captures.

Reports: [validation](validation.json), [reference workflow](reference-report.json), [self-catalog regression](self-catalog-regression.json), [data-fixture regression](fixture-regression.json). All reports identify the clean source above. [SHA256SUMS](SHA256SUMS) covers reports and screenshots; check with `shasum -a 256 -c SHA256SUMS` from this directory.

| Screenshot | Evidence |
| --- | --- |
| [Three destinations, desktop](three-destinations-desktop.png) | Fresh Dev 1.2.0 / Test 1.1.0 / disposable demo-Production 1.0.0; source/time and Open app |
| [Three destinations, mobile](three-destinations-mobile.png) | Responsive overview, no horizontal overflow |
| [Evidence disclosure](destination-evidence.png) | Full package identity and separate HTTP response hash/boot/source on demand |
| [Authorized upgrade](upgrade-authorized.png) / [mobile](upgrade-authorized-mobile.png) | Explicit declared decision; action still not dispatched |
| [Receipt before observation](receipt-before-observation.png) | Completed execution is not a running-version observation |
| [Test upgraded](test-upgraded.png) / [actual app](actual-test-app-upgraded.png) | Fresh Test 1.2.0 and real app banner; other two boots unchanged |
| [Test rolled back](test-rolled-back.png) / [actual app](actual-test-app-rolled-back.png) | Fresh Test 1.1.0 from original retained digest, new boot |
| [Stale request](stale-request.png) | Competing action changes incarnation; prior authorization cannot dispatch |
| [Unknown receipt, observed version](unknown-receipt-observed-version.png) | Withheld receipt stays unknown even after a valid fresh HTTP read |
| [Failed launch](failed-launch.png) | Explicitly injected startup failure after stopping old process |
| [Unavailable destination](unavailable-preserves-other-destinations.png) | Current Test unknown, prior version/time historical, other two freshly observed |

Native checks additionally exercise mandatory external digest verification without importing candidate code, altered/extra/linked package rejection, wrong version mappings, concurrent duplicate suppression, recommendations/declines/expiry, injected refusal, retained-package tampering before execution, malformed/oversized/timed-out version responses, wrong app/context/instance/boot/unknown digest, stopped-child port avoidance, origin/CSRF/fixed-input boundaries, marked-workspace/selection containment, explicit resume and an **actual controller SIGKILL after real launch while its terminal receipt is withheld**. Recovery preserves one consumed dispatch and an unknown result, never automatic replay. Earlier catalog/persistence/migration and fixture checks remain passing.

The first exploratory browser run used an over-specific accessible-name selector and timed out; the selector was corrected. These committed reports are the successful clean-source repeat, not that failed exploratory run. Screenshot inspection also led to collapsing an already-recorded decision form and clarifying the next action before this final capture.

Limits: all checks were Dev-run, with injected faults explicitly labeled. No independent Test reviewer, health certification, real Production or hostile-host attestation is established. The HTTP version is a runtime report validated against accepted artifact/context mapping; pre-execution byte verification supplies separate evidence. Node/OS and malicious same-user interference are outside the package boundary. Source SHA, package digest, response hash, decision, execution and observation are different facts. Resume creates fresh boots from retained selections, not continuous runtime or an automatic retry. Browser freshness updates on page render/explicit refresh, not by polling. Other operating systems/browsers remain untested.

[Issue #7 continuity](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662) records Sponsor acceptance/merge of Step A and bounded Step B development authorization as Dev transcription; it is not a separately authenticated GitHub role identity. **Step B awaits PM review and separate Sponsor merge authorization.** No unrelated project or GhostSentry3 was accessed.
