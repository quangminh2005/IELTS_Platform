// Parse/serialize Assignment.skillTimeLimitsJson: map kỹ năng -> số phút giới hạn.
// Bỏ qua giá trị không hợp lệ; JSON hỏng/null -> {}.
export function parseSkillTimeLimits(
  json: string | null | undefined
): Record<string, number> {
  if (!json) {
    return {};
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const minutes = Number(value);
      if (key && Number.isFinite(minutes) && minutes > 0) {
        result[key] = Math.floor(minutes);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeSkillTimeLimits(
  map: Record<string, number>
): string | null {
  const clean: Record<string, number> = {};
  for (const [skill, minutes] of Object.entries(map)) {
    if (Number.isFinite(minutes) && minutes > 0) {
      clean[skill] = Math.floor(minutes);
    }
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}
