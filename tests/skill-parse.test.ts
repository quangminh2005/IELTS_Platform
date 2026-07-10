import { describe, expect, it } from "vitest";
import { parseSkillTimeLimits, serializeSkillTimeLimits } from "@/lib/skill-parse";

describe("skill time limits", () => {
  it("parses valid minutes and drops bad values", () => {
    expect(parseSkillTimeLimits('{"listening":30,"reading":0,"writing":"x"}')).toEqual({
      listening: 30
    });
  });

  it("returns {} for null/broken json", () => {
    expect(parseSkillTimeLimits(null)).toEqual({});
    expect(parseSkillTimeLimits("not json")).toEqual({});
  });

  it("serializes to null when empty", () => {
    expect(serializeSkillTimeLimits({})).toBeNull();
    expect(serializeSkillTimeLimits({ reading: 60 })).toBe('{"reading":60}');
  });
});
