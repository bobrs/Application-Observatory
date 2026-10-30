export const externalHistoryIndexesSchema = `
  CREATE INDEX external_events_latest_observation
    ON external_events(destination_id, kind, julianday(observed_at) DESC, seq DESC);
  CREATE INDEX external_events_latest_known_observation
    ON external_events(destination_id, kind, outcome, julianday(observed_at) DESC, seq DESC);
  CREATE INDEX external_events_artifact_observation
    ON external_events(destination_id, kind, outcome, artifact_id, julianday(observed_at));
  CREATE INDEX external_events_target_sequence
    ON external_events(destination_id, seq DESC);
  CREATE INDEX external_events_directive_kind_sequence
    ON external_events(destination_id, directive_id, kind, seq DESC);
  PRAGMA user_version = 4;
`;
