# AO-INC-005 developer evidence

Clean implementation source **`fb3f55025bff709c3fe4ac13de414be42f96d1bd`**, based on accepted main **`64ba416a946d374fcbb9c04da7c42ed593b905b6`**. This subsequent evidence-only commit adds reports/captures and a README pointer. The PR records its final tested head; no executed source, scripts, tests, packages or dependencies change between these commits.

[Issue #11](https://github.com/bobrs/Application-Observatory/issues/11) defines the bounded interface refinement. [Dev intake](https://github.com/bobrs/Application-Observatory/issues/11#issuecomment-6488333113) transcribes the Sponsor's direct authorization in the Codex session, without a public session permalink or separately authenticated GitHub role identity. [Issue #9 completion](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487788461) records the accepted baseline. This increment requires PM review and separate Sponsor merge authorization.

Actual checks on Node 24.22.1 / npm 11.13.0, macOS arm64, Playwright 1.64.1 / Chromium 156.0.8078.4:

```sh
npm ci --no-fund
npm run verify
npm run demo
npm run demo:exercise
npm run demo:reference
npm run demo:portfolio
npm run demo:refinement
git diff --check origin/main...HEAD
```

Install PASS (57 installed / 58 audited, zero known package vulnerabilities reported, not a security assessment). Strict TypeScript/build PASS; **35 native tests passed, none failed/skipped**. All five browser workflows PASS on the clean source above with no unexpected page/console/HTTP errors or external requests. Owned test processes and generated fixtures are closed/removed after capture. Reports: [validation](validation.json), [new refinement journey](refinement-report.json), [normal portfolio/self-state](demo-report.json), [data-fixture regression](exercise-report.json), [real reference upgrade/rollback regression](reference-report.json), [variable-count layout regression](portfolio-report.json).

Protected comparisons pass for catalog/config/seed/schema, controller/model/workspace/adapter/targets, reference verifier/launcher/packages and local-server helper. The request-review function, POST handlers and origin/CSRF headers are byte-identical to the base. Only existing GET rendering/preselection routes change. Dependency lock differs only in project version; there is no new framework or persistence/domain model. The pending list and capability lead-in are read-only view projections of existing records and ownership, not new permissions or authorization rules.

## Desktop/mobile review captures

| Capture | Evidence |
| --- | --- |
| [Collapsed portfolio, desktop](portfolio-collapsed-desktop.png) / [mobile](portfolio-collapsed-mobile.png) | Compact register, no hero or operational forms; measured desktop rows **79px** each |
| [Expanded context, desktop](portfolio-expanded-desktop.png) / [mobile](portfolio-expanded-mobile.png) | Independent native Enter/Space disclosures, separate name navigation, sources/steward/uncertainty and Open application |
| [Preselected Test, desktop](preselected-test-desktop.png) / [mobile](preselected-test-mobile.png) | Exact allowlisted destination selected in the single shared form; native fragment brings controls into view |
| [Pending application decisions, desktop](pending-application-desktop.png) / [mobile](pending-application-mobile.png) | Two applicable requests for the same destination remain distinct; exact candidate, decision/conditions, next actor; pending before form |
| [Expanded activity/history](expanded-activity-history.png) | Three-entry preview with the remaining summaries and request evidence accessible |
| [Consumed before separate observation, desktop](consumed-before-observation-desktop.png) / [mobile](consumed-before-observation-mobile.png) | Completed receipt is not an observation; consumed request cannot dispatch again |
| [30-app illustrative register, desktop](illustrative-register-30-desktop.png) / [mobile](illustrative-register-30-mobile.png) | First-viewport captures; all 30 rows checked, no operational controls |
| [Long illustrative expanded text, mobile](illustrative-long-expanded-mobile.png) | Long unbroken name/description wraps without horizontal overflow |
| [Zero destinations](illustrative-zero-destinations.png) / [multiple per stage, mobile](illustrative-multiple-mobile.png) | Synthetic presentation examples, no Change version capability or runnable target |
| [Upgrade regression](regression-test-upgraded.png) / [original retained rollback](regression-test-rolled-back.png) | Real existing Test app 1.1.0 → 1.2.0 → retained 1.1.0, separate fresh HTTP observations |

The extra application/destination sizes are explicitly illustrative fixtures on a separate test server, not product registrations, process targets or runtime observations. Existing variable-count browser checks cover **0, 1, 3 and 6** destinations and 24 applications; the new register checks 30 applications, long text and desktop/mobile expansion. Only the original three owned local reference apps execute. Tall full-page mobile captures are intentional; larger-register images show the first viewport.

## Behavioral evidence and limits

- Real keyboard Tab/Enter/Space reach and operate the disclosure; multiple rows expand independently without navigation. Name links navigate separately. No interactive elements are nested inside summaries. GET/expand/preselection leave requests, observations, boot identities and bootstrap ledger unchanged.
- Every active destination card preselects its own fixed known ID; clicking creates no request or decision. Unknown, empty, duplicate, malicious or external-looking destination selections are rejected safely on canonical and legacy GETs, without executable forms or echoed input. POST unknown-target refusal remains enforced by the original controller. Stopped, unconnected and synthetic destinations do not gain Change version controls. Live unobserved/stale targets still require unchanged readiness checks.
- Application-wide pending includes unused, currently applicable requests awaiting a decision or holding valid exact declared authorization. Recommendations/deferrals/declines, current refusals, expiry, stale expected state and consumed requests remain history. A newer applicable decision can supersede an earlier pre-dispatch refusal under existing controller semantics. Missing receipts remain unknown execution even if a later observed version matches.
- The page order is destinations → pending → one shared proposal form → three concise recent entries → disclosed history/evidence. The preview no longer truncates the underlying summaries to six events or eight requests. All original ledger data remains unchanged; complete observations and request timelines stay accessible.
- Native checks retain previous package tamper/link, identity, target isolation, stale/duplicate/expiry, origin/CSRF, fault and real controller-crash recovery coverage. Assertions tied to the old hero/report cards were updated to test the new collapsed-versus-expanded contract; historical source/seed facts remain available in disclosures.

Exploratory browser checks found a text locator matching both visible context and hidden raw metadata, and an overly strict requirement that native fragment navigation align a form at exactly the viewport top. The locator was scoped, and the check now waits for the controls to be in view, as required by the operator story. These committed captures are successful clean-source runs.

All **18 screenshots and six JSON reports** are covered by [SHA256SUMS](SHA256SUMS). Check with `shasum -a 256 -c SHA256SUMS` from this directory.

Limits: Dev-run macOS/Chromium checks, not independent Test acceptance, health, standing or hostile-host attestation. Row height is content-dependent and mobile/long text wraps. Pending/readiness/freshness are evaluated on render, not live polling. This remains the same self-declared bounded local demo; no editable registry, new execution targets, integrations, permissions/IAM, schema, dependencies/framework, CI, real Production or external deployment. No unrelated project or GhostSentry3 access. **Stop at an unmerged PR for PM and separate Sponsor merge review.**
