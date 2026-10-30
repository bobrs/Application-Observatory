// External runtime directives and events are durable evidence, separate from the local demo ledger.
export const externalRuntimeSchema = `
  CREATE TABLE external_directives (
    id TEXT PRIMARY KEY, backend_id TEXT NOT NULL, application_id TEXT NOT NULL,
    destination_id TEXT NOT NULL, instance_id TEXT NOT NULL, action TEXT NOT NULL,
    version TEXT NOT NULL, artifact_id TEXT NOT NULL, created_at TEXT NOT NULL,
    expected_boot_id TEXT, actor TEXT NOT NULL, rationale TEXT NOT NULL
  );
  CREATE INDEX external_directives_target ON external_directives(destination_id, created_at DESC);
  CREATE TABLE external_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
    backend_id TEXT NOT NULL, application_id TEXT NOT NULL, destination_id TEXT NOT NULL,
    instance_id TEXT NOT NULL, directive_id TEXT, kind TEXT NOT NULL, source TEXT NOT NULL,
    detail TEXT NOT NULL, outcome TEXT NOT NULL, version TEXT, artifact_id TEXT,
    boot_id TEXT, observed_at TEXT, started_at TEXT, finished_at TEXT, recorded_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
  PRAGMA user_version = 3;
`;
