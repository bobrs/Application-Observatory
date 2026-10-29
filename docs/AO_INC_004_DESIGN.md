# AO-INC-004 — Executive portfolio and application drill-down

This is the small first layout implementation for [Issue #9](https://github.com/bobrs/Application-Observatory/issues/9), on accepted main `dcb893848b28caecf5dd0c3535a9f4872c4ac029`. [Dev intake](https://github.com/bobrs/Application-Observatory/issues/9#issuecomment-6487106032) transcribes the Sponsor's direct instruction to begin development, superseding the issue's earlier design-only restriction for this bounded slice. The design and implementation are submitted together for PM review; no separate PM design acceptance is implied. Merge requires separate Sponsor authorization.

## Screen hierarchy and compact wireframes

```text
PORTFOLIO — no operational forms, no global healthy/approved status
  Known applications: 2
  Application Observatory · self-entry                 View application →
    Purpose · steward role
    Version/location: Unknown · 0 concrete destinations
    Attention: no operational witness
    Next: Sponsor/steward decides whether scoped observations are needed
  Hello Observatory · disposable reference             View application →
    Purpose · demo operator role
    Version/location: brief stage/instance/version summary
    Attention: stale/unknown/conflicting snapshots or unknown execution
    Next: named role + suggested next action, not a new authorization

APPLICATION — operational detail is here
  Name · purpose · explicit scope/demo designation
  Next responsible role/action; standing ≠ execution credentials
  Destinations grouped by stage · Refresh observations (active demo only)
    Named instances · observed version / Unknown / Stale / Exception
    Source + original observation time · Open actual app
    Latest decision and action result kept separate · Evidence disclosure
  Recent consequential activity: concise source/time/meaning, not raw logs
  Recorded decisions/directives: scope, conditions, actor/claimed role,
    identity assurance, expiration; may exist without an executable request
  Propose version + concrete destination → review → decision → explicit apply
    Diagnostic faults in a separate disclosure
  Request history / immutable identity / historical metadata disclosures

REQUEST / DESTINATION CHANGE
  Exact version + destination + expected incarnation
  Readiness + bounded self-declared decision → explicit Apply
  Receipt / unknown execution → separately requested HTTP observation
  If dispatched: “Request consumed; a new decision is required for any
  further change.” Original criteria/reuse checks stay disclosed.
```

Source hashes and timelines remain available; they do not crowd the executive landing. Status meaning comes from text, not status colors. Existing muted styling and interactive link/button colors are retained; no automatic green health/approval cue is introduced.

## Zero, one, three and multiple instance shapes

The presentation model takes `destinations: DestinationView[]`; grouping is by each instance's stage string, never a stage-to-single-instance object or a required three-slot tuple.

| Shape | Presentation | Meaning / execution boundary |
| --- | --- | --- |
| Zero | Explicit empty state; no invented three stage cards | No concrete destinations connected; no running version established |
| One | Development → one named instance | Other stages need not have a target |
| Three | Development → Dev; Test → Test; Production → disposable Demo | Existing real local reference demonstration; no new target |
| Six | Development → two; Test → two; Production → one; Local review → one | **Illustrative layout only**, no registration, process, endpoint, observation or action |
| Larger portfolio | 24 illustrative app rows in browser / 30 in native test | Compact summary collection; no app discovery or onboarding capability |

Stage groups use responsive grids; groups with several instances expand without squeezing every instance into a universal three-column contract. The renderer accepts other counts/stages. The executable registry, workspace ownership, allowlisted artifacts and three existing destinations remain fixed. General target registration/management is outside this first slice. Synthetic layouts are served only by the capture script's separate test server, never product routes or operational data.

## Two distinct recognized applications, without rewriting history

Application Observatory keeps its original persisted metadata and original first-seed timestamp. Its own actual deployed state stays unknown; reference-app observations never become self-observations. The seeded AO-INC-001 next-review text remains in historical metadata evidence and is not used as a current executive decision.

Hello Observatory is a separate **known bundled definition** in the presentation collection, sourced to the accepted independent reference commit `da5731368d49c0426fd57a52588ff3db3e4a69e2`. It is not a new database seed or an invented registration/observation timestamp. Normal mode lists it with zero connected destinations and explains the inactive local session on drill-down. Only explicit `npm run reference` connects the existing three local processes. Catalog recognition is not application acceptance, organizational standing, health or Production readiness.

This avoids schema/data mutation for a presentation increment. A future editable/durable application registry needs its own scoped design and authorization; this implementation does not pretend to provide one.

## Copy and evidence distinctions

| State / term | User-facing meaning |
| --- | --- |
| Unknown | No valid current operational observation; not failed, healthy or approved |
| Stale | A previous snapshot is too old or belongs to a different runtime; refresh required |
| Reported | The runtime or launcher reports a fact; name that source and its limits |
| Observed | Fresh HTTP version response checked against accepted package mapping and owned context; not health or hostile-host attestation |
| Authorized | A bounded declared decision for an exact request, with role/identity assurance and expiry; no execution implied |
| Dispatched | Intent was durably recorded before sending an operation; not proof of completion |
| Completed / failed / unknown action | Launcher receipt or missing-result evidence; independent from observed version |
| Exception | A valid fresh observed version differs from the last dispatched candidate; show both facts and investigate |
| Unknown execution, observed version | Keep both statements: a matching observation does not repair a lost receipt |
| Disposable demo | Local reference context only; Production-classified target says **NOT REAL PRODUCTION** |
| Suggested next role/action | A navigation/review recommendation, not a binding directive or new authorization |
| Recorded directive only | Can be displayed without an executable request or an available technical capability |

Recent activity summarizes actual ledger decisions/dispatch/results and fresh observations with original times/sources. Current reuse checks on consumed requests are disclosed as reuse checks, not retrospective deployment errors. The backend checks remain unchanged.

## Reversible change and validation

Root `/` becomes the executive portfolio. `/applications/application-observatory` preserves honest self-state and historical evidence. `/applications/hello-observatory` hosts the reference operational overview; existing `/reference` and its request/POST routes remain compatible aliases/entry points. The earlier data-only `/exercise` is retained, reached through application detail rather than a portfolio control. No default mode starts reference targets or probes endpoints merely to render a page.

No database schema, seed, launcher, controller criteria, accepted package, dependency, integration, IAM, permission or deployment changes. A source rollback to the accepted base restores the earlier UI without database rollback. An older binary still needs its documented schema compatibility; this increment itself does not change schema 2.

Validation covers: executive → correct application → request → declared decision → apply → separate observation; consumed-request wording; unknown receipt remaining executive-visible; zero/one/three/multiple destination and larger portfolio layouts; responsive/escaped content; and all prior package, isolation, stale/duplicate, fault and crash-recovery checks. Screenshots distinguish real local workflows from synthetic design shapes. Dev-run macOS/Chromium checks are not independent Test acceptance, health or organizational authentication.

Deferred: search/filter/pagination for very large portfolios, editable registration/stewardship/directives, real organizational authority, new runtime destinations, monitoring/status wall, source-forge/CI APIs, deployment adapters, external hosting, CI and unrelated applications. Review the compact first layout before considering those additions.
