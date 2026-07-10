import { describe, expect, it } from "vitest";
import {
  orderedSkillTimes,
  parsePartTimes,
  sanitizePartTimesJson,
  skillTimesFromParts
} from "../lib/skill-times";

describe("parsePartTimes", () => {
  it("parses a valid map and floors seconds", () => {
    expect(parsePartTimes('{"u1":45,"u2":90.7}')).toEqual({ u1: 45, u2: 90 });
  });

  it("returns {} for null, empty, or broken JSON", () => {
    expect(parsePartTimes(null)).toEqual({});
    expect(parsePartTimes("")).toEqual({});
    expect(parsePartTimes("{not json")).toEqual({});
    expect(parsePartTimes("[1,2,3]")).toEqual({});
  });

  it("drops negative, non-numeric, and empty-key entries", () => {
    expect(parsePartTimes('{"u1":-5,"u2":"abc","":10,"u3":30}')).toEqual({ u3: 30 });
  });
});

describe("sanitizePartTimesJson", () => {
  it("re-serializes only valid entries", () => {
    expect(sanitizePartTimesJson('{"u1":10,"u2":-3}')).toBe('{"u1":10}');
  });

  it("returns null when nothing valid remains", () => {
    expect(sanitizePartTimesJson(null)).toBeNull();
    expect(sanitizePartTimesJson("{}")).toBeNull();
    expect(sanitizePartTimesJson("garbage")).toBeNull();
  });
});

describe("skillTimesFromParts", () => {
  const unitSkills = { r1: "reading", r2: "reading", l1: "listening" };

  it("sums parts of the same skill", () => {
    expect(
      skillTimesFromParts('{"r1":1200,"r2":900,"l1":600}', unitSkills)
    ).toEqual({ reading: 2100, listening: 600 });
  });

  it("ignores parts with no known skill", () => {
    expect(skillTimesFromParts('{"r1":100,"ghost":999}', unitSkills)).toEqual({
      reading: 100
    });
  });

  it("returns {} when there is no time data", () => {
    expect(skillTimesFromParts(null, unitSkills)).toEqual({});
  });
});

describe("orderedSkillTimes", () => {
  it("orders listening before reading and keeps unknown skills last", () => {
    const rows = orderedSkillTimes({ reading: 200, listening: 100, writing: 50 });
    expect(rows.map((row) => row.skill)).toEqual(["listening", "reading", "writing"]);
  });
});
