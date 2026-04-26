function stripPrivateFields(value: any): any {
  if (Array.isArray(value)) return value.map(stripPrivateFields);

  if (value && typeof value === "object") {
    const out: any = {};

    for (const [k, v] of Object.entries(value)) {
      if (
        k === "profile_id" ||
        k === "created_by_profile_id" ||
        k === "source_upload_id" ||
        k === "upload_id" ||
        k === "source" ||
        k === "saved_at" ||
        k === "_history"
      ) {
        continue;
      }

      out[k] = stripPrivateFields(v);
    }

    return out;
  }

  return value;
}

export async function saveAnonymousGameObservation(
  sb: any,
  input: {
    observation_type: string;
    entity_type: string;
    entity_key: string;
    value: any;
  }
) {
  const observed_value = stripPrivateFields(input.value);

  return sb.from("game_observations").insert({
    observation_type: input.observation_type,
    entity_type: input.entity_type,
    entity_key: input.entity_key,
    attributes: {
      kind: observed_value?.kind ?? input.observation_type,
    },
    observed_value,
    confidence: 1,
    source: "player_upload",
    updated_at: new Date().toISOString(),
  });
}
