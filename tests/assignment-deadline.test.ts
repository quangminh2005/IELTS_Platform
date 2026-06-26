import { describe, expect, it } from "vitest";
import { parseAssignmentDeadline } from "../lib/assignment-deadline";

describe("parseAssignmentDeadline", () => {
  it("combines due date and time using the Vietnam timezone", () => {
    expect(parseAssignmentDeadline("2026-06-30", "21:15")?.toISOString()).toBe(
      "2026-06-30T14:15:00.000Z"
    );
  });

  it("defaults date-only deadlines to the end of the selected day", () => {
    expect(parseAssignmentDeadline("2026-06-30", "")?.toISOString()).toBe(
      "2026-06-30T16:59:00.000Z"
    );
  });

  it("leaves the deadline empty when no date is selected", () => {
    expect(parseAssignmentDeadline("", "21:15")).toBeNull();
  });
});
