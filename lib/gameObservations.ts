export async function saveGameObservation(sb: any, input: {
  observation_type: string;
  entity_type: string;
  entity_key: string;
  attributes?: any;
  observed_value: any;
  source?: string;
}) {
  const attributes = input.attributes ?? {};
  const observed_value = input.observed_value ?? {};

  return sb
    .from("game_observations")
    .upsert(
      {
        observation_type: input.observation_type,
        entity_type: input.entity_type,
        entity_key: input.entity_key,
        attributes,
        observed_value,
        confidence: 1.0,
        source: input.source ?? "player_upload",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "observation_type,entity_type,entity_key,md5(attributes::text),md5(observed_value::text)",
      }
    );
}
