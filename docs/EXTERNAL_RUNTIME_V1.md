# External runtime API v1

AO-X01 connects one externally managed Hello Observatory Test destination to the Observatory portfolio. The product stores desired directives and separately submitted evidence. It does not start processes, run commands, probe an endpoint during page rendering, or know host paths or service configuration.

The Program contract is the protocol authority. This page describes the Observatory implementation; it does not replace the cross-project contract.

## Enable the integration

`npm start` remains in the normal read-only mode when neither external variable is set. To opt in, provide both `AO_EXTERNAL_CONFIG` (an absolute path to owner-readable JSON with mode `0600`) and `AO_EXTERNAL_TOKEN` (a private bearer secret of at least 24 characters). The public-safe placeholder file is [examples/external-runtime-config.example.json](../examples/external-runtime-config.example.json); replace all placeholder identities and digests with operator-managed config. Never commit the real config or token. Supplying only one variable is a startup error. External mode cannot run with `--exercise` or `--reference` because those ledgers represent separate evidence sources.

The alpha accepts one configured target whose application is `observatory-hello-reference` and stage is `Test`. Backend, target and instance IDs plus allowlisted release version/artifact pairs come from operator config. Artifact IDs have the form `sha256:` plus 64 lowercase hexadecimal digits. No executable, URL, host path or command is permitted in product config.

The server continues to bind to loopback and enforce local Host names. Authenticated clients call these paths with `Authorization: Bearer <AO_EXTERNAL_TOKEN>`:

* `GET /api/runtime/v1/targets/:targetId/directive` returns `{ "schemaVersion": 1, "directive": null | Directive }`. It only reads the latest immutable directive.
* `POST /api/runtime/v1/targets/:targetId/events` accepts a strict receipt or observation event and returns `{ "schemaVersion": 1, "accepted": true, "duplicate": boolean }`.

Requests are bounded to 4 KiB. Authentication runs before body parsing and validation. Unknown targets, mismatched identities, unconfigured artifact pairs, unsupported fields, invalid UTC timestamps, and unrelated directive IDs are rejected. Exact semantic retries with the same event ID are accepted without another history row; a changed payload under an existing ID conflicts. The token is never sent to browser HTML or logged by this application.

## Directive and evidence lifecycle

The Hello detail page shows the configured external destination alongside existing local references. Deploy/version-change and rollback forms select only configured version/artifact pairs and require a self-declared actor and rationale. A submission creates one SQLite-backed directive. Its ID is server-generated, and the API directive has exactly the v1 fields: schema version, ID, backend/application/destination/instance IDs, action, version, artifact ID, creation time, and expected boot ID. The local actor/rationale stay in Observatory history and are not authenticated organizational authorization.

The directive object is exactly this shape (values are illustrative):

```json
{
  "id": "opaque-unique-id",
  "backendId": "configured-backend",
  "applicationId": "observatory-hello-reference",
  "destinationId": "configured-target",
  "instanceId": "configured-incarnation",
  "action": "deploy",
  "version": "1.0.0",
  "artifactId": "sha256:<64-lowercase-hex>",
  "createdAt": "ISO-UTC",
  "expectedBootId": null
}
```

Every event includes exactly `schemaVersion`, `eventId`, `backendId`, `applicationId`, `destinationId`, `instanceId`, `directiveId`, `kind`, `source`, and `detail`. A receipt adds exactly `outcome` (`completed`, `failed`, or `unknown`), `artifactId`, `startedAt`, and `finishedAt`. Its directive ID must exist on the target and its artifact must match that directive. An observation adds exactly `outcome` (`observed` or `unknown`), `observedAt`, `version`, `artifactId`, and `bootId`. Observed fields must match a configured pair; unknown observations use null for version/artifact/boot. The server supplies `recordedAt` and rejects it in client payloads.

Rendering reads SQLite only. The external client polls the directive endpoint and performs external operations under its own bounded protocol. It separately posts receipts and runtime observations. A completed receipt means an operation returned; it is not a running-version observation, health claim, or acceptance decision. An observation must identify a configured version/artifact pair and boot. Unknown observations carry null version/artifact/boot values. Event source/detail strings are evidence descriptions, never operation input.

Only one unresolved directive may exist per target. An absent/unknown receipt blocks another directive. A completed receipt remains unconfirmed until a fresh matching observation collected after both the directive and receipt; the observed boot must also differ from a non-null expected boot. Contradictory evidence stays visible. A failed receipt requires a new observation collected after the failure before another directive. Initial deployment can be created without an observation and uses `expectedBootId: null`. Subsequent directives carry the fresh observed boot ID. A deliberate rollback selects a configured retained artifact and records a new directive; it is not an automatic response to failure.

When a directive remains unresolved, a local operator may record a same-origin **reconciliation** against the latest directive and latest fresh observed event. The readback must have been collected after directive creation and, when a receipt exists, after its finish time. The form records actor, rationale, exact witness event ID, artifact/version, boot, time and the receipt outcome/correlation present at acknowledgement. Reconciliation is an internal, append-only Observatory event, not an external API event; the bearer API accepts only contract receipt/observation variants. It does not change a missing/unknown receipt, claim that execution succeeded, or rerun the directive. The separate `executionUnknown` state remains visible after acknowledgement. The acknowledgement remains current across another fresh read with the same observed version/artifact/instance/boot and unchanged receipt outcome/correlation; a changed boot/artifact/instance/version, unknown or stale read, or changed receipt requires a new acknowledgement. A subsequent directive is a new operator choice and binds to the current observed boot.

If the target is unavailable and no fresh version readback can be collected, reconciliation cannot be recorded. Repair the external target/client through its owner and obtain a fresh readback first; Observatory offers no blind continuation or replay.

Freshness is five minutes and uses both external collection time and server record time. Old or unknown incoming observations remain in history and cannot refresh old evidence. The UI provides no automatic replay or background target probing. A browser refresh only re-renders the latest persisted records.

## Storage and recovery

Migration 003 adds `external_directives` and `external_events`; migration 004 adds indexes for millisecond-accurate latest-observation chronology, full-ledger rollback witnesses, target event pages and directive receipts/previews, then advances SQLite to schema 4. The event table stores the canonical accepted event payload and server `recordedAt`, preserving idempotence and history across restarts. Hello detail renders bounded recent projections and links to two read-only ledgers: `/applications/hello-observatory/history` for events and `/applications/hello-observatory/directives` for every directive, including ones without events. Both use fixed-size keyset pages inside an upper-sequence snapshot, so concurrent arrivals wait for a refreshed traversal; no rows are discarded. Page queries accept only one bounded pair of numeric cursors. Back up the stopped data directory before upgrading if the prior executable must remain usable; prior binaries reject newer schemas. Restoring SQLite restores Observatory-side evidence, not external client claim state or target processes.

`npm run verify` covers bearer rejection, malformed and extra fields, identity/correlation/artifact checks, duplicate and conflicting event IDs, persistence, initial deployment, completed receipt versus observation, rollback, stale/unknown/contradictory projection, large retained histories with bounded previews and paging, and existing local-mode regressions. Developer checks are not independent Test acceptance.
