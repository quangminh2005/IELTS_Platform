import { describe, expect, it } from "vitest";
import {
  computeStatus,
  defaultMaterialFilters,
  deriveSeries,
  filterAndSortMaterials,
  filterMaterials,
  type MaterialFilters,
  type MaterialMeta
} from "../lib/materials-filter";

describe("deriveSeries", () => {
  it("lấy phần trước dấu en-dash", () => {
    expect(deriveSeries("IELTS Master – Reading Test 5", "x")).toBe("IELTS Master");
  });

  it("nhận hyphen có khoảng trắng hai bên", () => {
    expect(deriveSeries("Cambridge IELTS 20 - Test 1", "x")).toBe("Cambridge IELTS 20");
  });

  it("không cắt nhầm từ nối như Well-being", () => {
    expect(deriveSeries("Well-being Passage", "x")).toBe("Well-being Passage");
  });

  it("fallback về title khi không có sourceLabel", () => {
    expect(deriveSeries(null, "Cambridge IELTS 20 – Test 2")).toBe("Cambridge IELTS 20");
  });

  it("giữ nguyên chuỗi khi không có dấu ngăn cách", () => {
    expect(deriveSeries("IELTS Master", "x")).toBe("IELTS Master");
  });
});

describe("computeStatus", () => {
  it("đánh dấu rỗng khi không có phần", () => {
    expect(computeStatus("listening", [])).toMatchObject({
      isEmpty: true,
      isComplete: false
    });
  });

  it("listening thiếu audio nếu có phần thiếu file", () => {
    const status = computeStatus("listening", [
      { hasAudio: true, questionCount: 10 },
      { hasAudio: false, questionCount: 10 }
    ]);
    expect(status).toMatchObject({ missingAudio: true, isComplete: false });
  });

  it("listening đủ audio + câu hỏi là hoàn chỉnh", () => {
    const status = computeStatus("listening", [
      { hasAudio: true, questionCount: 10 }
    ]);
    expect(status).toMatchObject({
      missingAudio: false,
      missingQuestions: false,
      isComplete: true
    });
  });

  it("reading không quan tâm audio, chỉ cần câu hỏi", () => {
    const status = computeStatus("reading", [
      { hasAudio: false, questionCount: 13 }
    ]);
    expect(status).toMatchObject({ missingAudio: false, isComplete: true });
  });

  it("reading thiếu câu hỏi nếu có phần 0 câu", () => {
    const status = computeStatus("reading", [
      { hasAudio: false, questionCount: 0 }
    ]);
    expect(status).toMatchObject({ missingQuestions: true, isComplete: false });
  });

  it("writing có phần là hoàn chỉnh dù không audio/câu hỏi", () => {
    const status = computeStatus("writing", [
      { hasAudio: false, questionCount: 0 }
    ]);
    expect(status).toMatchObject({
      missingAudio: false,
      missingQuestions: false,
      isComplete: true
    });
  });
});

function meta(overrides: Partial<MaterialMeta>): MaterialMeta {
  return {
    id: "id",
    title: "title",
    skill: "reading",
    series: "IELTS Master",
    unitCount: 1,
    questionCount: 10,
    createdAtMs: 0,
    lastAssignedAtMs: null,
    status: {
      isEmpty: false,
      missingAudio: false,
      missingQuestions: false,
      isComplete: true
    },
    searchText: "title",
    practiceOpen: false,
    ...overrides
  };
}

const baseFilters: MaterialFilters = {
  search: "",
  skill: "all",
  series: "all",
  status: "all",
  practice: "all",
  sort: "newest"
};

describe("filterAndSortMaterials", () => {
  const items = [
    meta({ id: "a", skill: "listening", series: "Cambridge IELTS 20", createdAtMs: 100, questionCount: 40, unitCount: 4, searchText: "cam20 listening test 1", lastAssignedAtMs: 300 }),
    meta({ id: "b", skill: "reading", series: "IELTS Master", createdAtMs: 200, questionCount: 13, unitCount: 3, searchText: "ielts master reading test 5", lastAssignedAtMs: 100 }),
    meta({ id: "c", skill: "reading", series: "IELTS Master", createdAtMs: 300, questionCount: 27, unitCount: 1, searchText: "ielts master reading test 6", lastAssignedAtMs: null })
  ];

  it("search khớp theo searchText", () => {
    const out = filterAndSortMaterials(items, { ...baseFilters, search: "test 5" });
    expect(out.map((m) => m.id)).toEqual(["b"]);
  });

  it("lọc theo kỹ năng", () => {
    const out = filterAndSortMaterials(items, { ...baseFilters, skill: "reading" });
    expect(out.map((m) => m.id).sort()).toEqual(["b", "c"]);
  });

  it("lọc theo bộ sách", () => {
    const out = filterAndSortMaterials(items, { ...baseFilters, series: "Cambridge IELTS 20" });
    expect(out.map((m) => m.id)).toEqual(["a"]);
  });

  it("sort mới nhất (mặc định) theo createdAt giảm dần", () => {
    const out = filterAndSortMaterials(items, baseFilters);
    expect(out.map((m) => m.id)).toEqual(["c", "b", "a"]);
  });

  it("sort nhiều câu nhất", () => {
    const out = filterAndSortMaterials(items, { ...baseFilters, sort: "questions" });
    expect(out.map((m) => m.id)).toEqual(["a", "c", "b"]);
  });

  it("sort nhiều phần nhất", () => {
    const out = filterAndSortMaterials(items, { ...baseFilters, sort: "parts" });
    expect(out.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("sort giao gần đây, chưa giao xuống cuối", () => {
    const out = filterAndSortMaterials(items, { ...baseFilters, sort: "assigned" });
    expect(out.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("không đụng mảng gốc khi sort", () => {
    const before = items.map((m) => m.id);
    filterAndSortMaterials(items, { ...baseFilters, sort: "questions" });
    expect(items.map((m) => m.id)).toEqual(before);
  });
});

describe("lọc theo thư viện tự luyện", () => {
  const base = {
    skill: "reading",
    series: "Cambridge",
    unitCount: 3,
    questionCount: 40,
    createdAtMs: 0,
    lastAssignedAtMs: null,
    status: {
      isEmpty: false,
      missingAudio: false,
      missingQuestions: false,
      isComplete: true
    }
  };

  const metas = [
    { ...base, id: "m1", title: "Đề mở", searchText: "đề mở", practiceOpen: true },
    { ...base, id: "m2", title: "Đề đóng", searchText: "đề đóng", practiceOpen: false }
  ];

  it("mặc định hiện cả đề mở lẫn đề đóng", () => {
    const result = filterMaterials(metas, defaultMaterialFilters);
    expect(result.map((meta) => meta.id)).toEqual(["m1", "m2"]);
  });

  it('chọn "open" thì chỉ còn đề đang mở tự luyện', () => {
    const result = filterMaterials(metas, { ...defaultMaterialFilters, practice: "open" });
    expect(result.map((meta) => meta.id)).toEqual(["m1"]);
  });
});
