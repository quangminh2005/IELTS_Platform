import { describe, expect, it } from "vitest";
import {
  vnDayKey,
  bucketAssignmentsByDay,
  buildMonthGrid,
  type CalendarAssignment
} from "../lib/assignment-calendar";

function fakeAssignment(
  id: string,
  createdAt: string,
  deadline: string | null
): CalendarAssignment {
  return { id, title: id, createdAt, deadline, unitCount: 1, recipients: [] };
}

describe("vnDayKey", () => {
  it("chuyển mốc UTC sang ngày theo lịch Việt Nam (UTC+7)", () => {
    // 18:00Z ngày 02/07 => 01:00 ngày 03/07 giờ VN
    expect(vnDayKey("2026-07-02T18:00:00.000Z")).toBe("2026-07-03");
  });
});

describe("bucketAssignmentsByDay", () => {
  const a = fakeAssignment("a", "2026-07-02T18:00:00.000Z", "2026-07-05T16:59:00.000Z");
  const b = fakeAssignment("b", "2026-07-03T02:00:00.000Z", null);

  it("xếp theo ngày giao (giờ VN)", () => {
    const map = bucketAssignmentsByDay([a, b], "assigned");
    expect(map.get("2026-07-03")?.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("xếp theo hạn nộp và bỏ bài không có hạn", () => {
    const map = bucketAssignmentsByDay([a, b], "deadline");
    expect(map.get("2026-07-05")?.map((x) => x.id)).toEqual(["a"]);
    expect([...map.values()].flat().map((x) => x.id)).toEqual(["a"]);
  });
});

describe("buildMonthGrid", () => {
  it("chèn ô trống đầu tháng theo tuần bắt đầu Thứ Hai", () => {
    // Tháng 7/2026: ngày 1 là Thứ Tư => 2 ô trống đầu
    const cells = buildMonthGrid(2026, 6);
    expect(cells.slice(0, 4)).toEqual([null, null, "2026-07-01", "2026-07-02"]);
    expect(cells).toContain("2026-07-31");
    expect(cells.length % 7).toBe(0);
  });
});
