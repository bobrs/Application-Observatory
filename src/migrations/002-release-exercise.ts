// Only the opt-in disposable exercise writes these domain-specific records.
export const exerciseSchema = `
  CREATE TABLE exercise_requests (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, plan TEXT NOT NULL);
  CREATE TABLE exercise_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL,
    kind TEXT NOT NULL, recorded_at TEXT NOT NULL, source TEXT NOT NULL, data TEXT NOT NULL
  );
  CREATE TABLE exercise_attempts (
    request_id TEXT PRIMARY KEY, operation_id TEXT NOT NULL UNIQUE, decision_seq INTEGER NOT NULL,
    dispatched_at TEXT NOT NULL
  );
  CREATE TABLE exercise_observations (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, environment_id TEXT NOT NULL,
    request_id TEXT, after_operation_id TEXT, recorded_at TEXT NOT NULL, data TEXT NOT NULL
  );
  PRAGMA user_version = 2;
`;
