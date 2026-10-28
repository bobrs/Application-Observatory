// Migration 1: catalog metadata only. No deployment, health or approval records.
export const schemaVersion = 1;
export const schema = `
  CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    stewardship TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_revision TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    next_decision TEXT NOT NULL,
    next_decision_source TEXT NOT NULL
  );
  PRAGMA user_version = 1;
`;
