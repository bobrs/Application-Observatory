# AO-INC-004 developer evidence

Clean implementation source **`37cd0b26d489168e0a9d3364f49ba09bf181650e`**, based on accepted main **`dcb893848b28caecf5dd0c3535a9f4872c4ac029`**. This subsequent evidence-only commit adds captures/reports and a README link; the PR records its exact final tested head. No executed source, fixtures, tests or dependencies change between these commits.

[Issue #9 intake and direct Sponsor authorization transcription](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487106032) supersedes the original design-only status for this bounded first layout. [Design, wireframes, copy and reversal](../../AO_INC_004_DESIGN.md) accompany the implementation; separate PM design acceptance is not inferred. [PR #8 completion](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6487105707) records the accepted base and merge provenance. Roles through the shared GitHub account are attributed, not independently authenticated identities.

Actual checks on Node 24.22.1 / npm 11.13.0, macOS arm64, Playwright 1.64.1 / Chromium 156.0.8078.4:

```sh
npm ci --no-fund
npm run verify
npm run demo
npm run demo:exercise
npm run demo:reference
npm run demo:portfolio
git diff --check origin/main...HEAD
```

Install PASS (57 installed / 58 audited, zero known package vulnerabilities reported, not a security assessment); strict TypeScript/build PASS; **32 native tests passed, none failed/skipped**. All four browser workflows PASS with no page/console/HTTP errors or external requests. Reports identify the clean source above: [validation](validation.json), [portfolio journey / synthetic layouts](portfolio-report.json), [default portfolio / self-state](demo-report.json), [data-fixture regression](exercise-report.json), [real reference upgrade/rollback regression](reference-report.json).

Protected-source comparison against accepted main passes for catalog/seeds/config/schema, controller/criteria/workspace/adapter/target, trusted package verifier/launcher, accepted packages and local-server helper. Dependency lock differs only in project version. Default rendering starts no target and manufactures no observation. Existing ledger/HTTP safeguards remain tested. UI assertions now check honest zero concrete destinations for the self-entry and preservation of the old seeded review text as history, replacing the earlier universal three-stage-placeholder assumption.

## Real local application screenshots

| Capture | Meaning |
| --- | --- |
| [Portfolio before observations](portfolio-unknown-desktop.png) | Two distinct known applications, honest unknowns and next role/action; no operational forms |
| [Observed portfolio](portfolio-observed-desktop.png) / [mobile](portfolio-observed-mobile.png) | Compact stage/version summaries, self-state still unknown, no global health/approval |
| [Hello detail](application-observed-desktop.png) / [mobile](application-observed-mobile.png) | Concrete destination groups, actual reported versions, source/time, controls after drill-down |
| [Consumed request](consumed-request.png) | Explicit non-reuse guidance; current reuse checks disclosed, not retrospective execution errors |
| [Activity and decision](activity-and-decision.png) | Meaningful attributed activity, scope/conditions/expiry/identity near its decision |
| [Unknown execution](portfolio-unknown-execution.png) | Missing terminal receipt stays visible even with a matching fresh version |
| [Upgrade regression](regression-test-upgraded.png) / [retained rollback](regression-test-rolled-back.png) | Actual existing Test process changes 1.1.0 → 1.2.0 → original retained 1.1.0, independently refreshed |

## Synthetic design examples — not runtime evidence

| Capture | Layout shape |
| --- | --- |
| [Zero destinations](illustrative-zero-destinations.png) | No invented instances/version |
| [One destination](illustrative-one-destinations.png) | One stage can have one instance without others |
| [Three destinations](illustrative-three-destinations.png) | Three stage groups; illustrative unknowns |
| [Multiple per stage](illustrative-multiple-destinations.png) / [mobile](illustrative-multiple-mobile.png) | Six synthetic instances, two in Development and Test, plus an additional stage |
| [24-application portfolio](illustrative-portfolio-24-applications.png) | First viewport of a larger synthetic collection; all 24 rows and mobile overflow checked |

These shapes are served only by the capture script's separate disposable test server and explicitly labeled **ILLUSTRATIVE LAYOUT — NOT LIVE**. They create no product registration, executable target, runtime observation or permission. Only the existing three trusted reference apps run. Native tests also cover 30 synthetic application summaries and a recommendation/directive without an executable request.

All 16 screenshots and five reports are covered by [SHA256SUMS](SHA256SUMS). Run `shasum -a 256 -c SHA256SUMS` from this directory. Full-page mobile captures are intentionally tall; the large-portfolio image is a first-viewport capture. Owned test servers/processes and generated data were closed/removed after capture.

Exploratory checks identified an obsolete three-placeholder UI assertion and mobile header overflow. Assertions were changed to the new honest zero-instance contract, and the header was made to wrap. These reports/screenshots are the subsequent successful clean-source runs, not the exploratory failures.

Limitations: Dev-run macOS/Chromium only, no independent Test/health/organizational-standing or hostile-host attestation. Hello is a known bundled presentation definition, not an editable/durable application registry or a new database seed. Variable-count presentation is not general target management. No search/filter/pagination or editable directives/registration; those remain separate product decisions. Normal mode has no live reference observations. Idle-page freshness changes on render/refresh. No dependencies, schema, IAM, permissions, integrations, CI, external deployment or unrelated project/GhostSentry3 access.

**Stop:** PM reviews this first layout/design and evidence. Product Sponsor separately authorizes merge. This increment is not merged or deployed by its development authorization.
