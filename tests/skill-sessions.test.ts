import { describe, expect, it } from "vitest";
import {
  allSkillsSubmitted,
  orderedSkillsOfAssignment,
  pickerSkillStatus,
  unitsForSkill
} from "@/lib/skill-sessions";

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

describe("pickerSkillStatus", () => {
  it("kỹ năng vừa mở trong phiên trang hiện 'Đang làm' dù dữ liệu server còn cũ", () => {
    expect(pickerSkillStatus("not_started", true)).toBe("in_progress");
    expect(pickerSkillStatus(undefined, true)).toBe("in_progress");
  });

  it("chưa mở thì giữ trạng thái server", () => {
    expect(pickerSkillStatus("not_started", false)).toBe("not_started");
    expect(pickerSkillStatus(undefined, false)).toBe("not_started");
    expect(pickerSkillStatus("in_progress", false)).toBe("in_progress");
  });

  it("đã nộp luôn là đã nộp", () => {
    expect(pickerSkillStatus("submitted", true)).toBe("submitted");
  });
});
