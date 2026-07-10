import { describe, expect, it } from "vitest";
import { allSkillsSubmitted, orderedSkillsOfAssignment, unitsForSkill } from "@/lib/skill-sessions";

const units = [
  { assignableUnit: { skill: "reading" } },
  { assignableUnit: { skill: "listening" } },
  { assignableUnit: { skill: "reading" } }
];

describe("skill sessions", () => {
  it("lists distinct skills in IELTS order", () => {
    expect(orderedSkillsOfAssignment(units)).toEqual(["listening", "reading"]);
  });

  it("filters units for a skill", () => {
    expect(unitsForSkill(units, "reading")).toHaveLength(2);
  });

  it("detects all submitted", () => {
    expect(allSkillsSubmitted([{ status: "submitted" }, { status: "submitted" }])).toBe(true);
    expect(allSkillsSubmitted([{ status: "submitted" }, { status: "in_progress" }])).toBe(false);
    expect(allSkillsSubmitted([])).toBe(false);
  });
});
