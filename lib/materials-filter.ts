// Logic thuần cho bộ lọc Kho đề (search / filter / sort / tag trạng thái).
// Tách khỏi UI để unit-test dễ dàng (xem tests/materials-filter.test.ts).

import { UNNAMED_SHELF, type MaterialCategory } from "./material-category";

export type SortKey = "newest" | "title" | "questions" | "parts" | "assigned";

export type StatusFilter =
  | "all"
  | "complete"
  | "missing_audio"
  | "missing_questions"
  | "empty";

// Cờ trạng thái của một tài liệu (có thể chồng nhau, ví dụ thiếu cả audio lẫn câu hỏi).
export type MaterialStatusFlags = {
  isEmpty: boolean;
  missingAudio: boolean;
  missingQuestions: boolean;
  isComplete: boolean;
};

// Tóm tắt một phần (unit) đủ để tính trạng thái.
export type MaterialUnitSummary = {
  hasAudio: boolean;
  questionCount: number;
};

// Dữ liệu nhẹ mỗi tài liệu để lọc/sắp xếp (server dựng sẵn, truyền cho client).
export type MaterialMeta = {
  id: string;
  title: string;
  skill: string;
  series: string;
  unitCount: number;
  questionCount: number;
  createdAtMs: number;
  lastAssignedAtMs: number | null;
  status: MaterialStatusFlags;
  // Chuỗi thường-hoá để search (title + sourceLabel), tránh tính lại mỗi lần gõ.
  searchText: string;
  // Đề có đang nằm trong thư viện tự luyện của học viên không.
  practiceOpen: boolean;
  // Sách/bộ đề hay bài tập hàng tuần. Với sách, `series` là tên kệ sách.
  category: MaterialCategory;
};

export type PracticeFilter = "all" | "open";

export type MaterialFilters = {
  search: string;
  skill: string; // "all" hoặc một kỹ năng
  series: string; // "all" hoặc tên bộ sách
  status: StatusFilter;
  practice: PracticeFilter; // "all" hoặc "open"
  category: "all" | MaterialCategory;
  sort: SortKey;
};

export const defaultMaterialFilters: MaterialFilters = {
  search: "",
  skill: "all",
  series: "all",
  status: "all",
  practice: "all",
  category: "all",
  sort: "newest"
};

// Tách nhãn theo dấu ngăn cách phổ biến: en/em dash (kèm khoảng trắng tuỳ ý),
// hyphen có khoảng trắng hai bên, hoặc dấu gạch đứng. Tránh cắt nhầm từ nối
// như "Well-being" (hyphen không có khoảng trắng bao quanh).
const SERIES_SEPARATOR = /\s*[–—]\s*|\s+-\s+|\s*\|\s*/;

// Suy ra tên bộ sách từ sourceLabel (ưu tiên) hoặc title.
// "IELTS Master – Reading Test 5" -> "IELTS Master".
export function deriveSeries(
  sourceLabel: string | null | undefined,
  title: string
): string {
  const base = (sourceLabel?.trim() || title || "").trim();
  if (!base) return "Khác";
  const [first] = base.split(SERIES_SEPARATOR);
  const series = first?.trim();
  return series && series.length > 0 ? series : base;
}

// Tính cờ trạng thái theo kỹ năng.
// - Listening: cần audio ở mọi phần + câu hỏi ở mọi phần.
// - Reading: cần câu hỏi ở mọi phần (không cần audio).
// - Writing/Speaking: có ≥1 phần là coi như hoàn chỉnh (không cần audio/câu hỏi).
export function computeStatus(
  skill: string,
  units: MaterialUnitSummary[]
): MaterialStatusFlags {
  if (units.length === 0) {
    return {
      isEmpty: true,
      missingAudio: false,
      missingQuestions: false,
      isComplete: false
    };
  }

  const checksAudio = skill === "listening";
  const checksQuestions = skill === "listening" || skill === "reading";

  const missingAudio = checksAudio && units.some((unit) => !unit.hasAudio);
  const missingQuestions =
    checksQuestions && units.some((unit) => unit.questionCount === 0);

  return {
    isEmpty: false,
    missingAudio,
    missingQuestions,
    isComplete: !missingAudio && !missingQuestions
  };
}

function matchesStatus(meta: MaterialMeta, status: StatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "complete":
      return meta.status.isComplete;
    case "missing_audio":
      return meta.status.missingAudio;
    case "missing_questions":
      return meta.status.missingQuestions;
    case "empty":
      return meta.status.isEmpty;
    default:
      return true;
  }
}

export function filterMaterials(
  metas: MaterialMeta[],
  filters: MaterialFilters
): MaterialMeta[] {
  const query = filters.search.trim().toLowerCase();
  return metas.filter((meta) => {
    if (query && !meta.searchText.includes(query)) return false;
    if (filters.category !== "all" && meta.category !== filters.category) return false;
    if (filters.skill !== "all" && meta.skill !== filters.skill) return false;
    if (filters.series !== "all" && meta.series !== filters.series) return false;
    if (filters.practice === "open" && !meta.practiceOpen) return false;
    if (!matchesStatus(meta, filters.status)) return false;
    return true;
  });
}

// Số đề trong tên: "… Listening Test 24", "… – Test 9 (Reading)", "… Unit 3".
const TEST_NUMBER = /\b(?:test|unit|chapter)\s*(\d+)/i;

// Tên đề trên prod đặt không đồng nhất (gạch dài "–" lẫn gạch ngắn "-", "Reading Test 2"
// lẫn "Test 9 (Reading)"), nên ưu tiên so theo số Test; không có số thì so tên tự nhiên
// ("Test 2" trước "Test 10") sau khi quy mọi kiểu gạch về một.
function compareTitles(a: string, b: string): number {
  const numberA = TEST_NUMBER.exec(a)?.[1];
  const numberB = TEST_NUMBER.exec(b)?.[1];
  if (numberA && numberB && numberA !== numberB) {
    return Number(numberA) - Number(numberB);
  }
  const normalize = (title: string) => title.replace(/[‐‑‒–—―−]/g, "-").replace(/\s+/g, " ").trim();
  return normalize(a).localeCompare(normalize(b), "vi", { numeric: true });
}

// Sắp xếp: tạo bản sao, không đụng mảng gốc. Tie-break luôn về mới nhất cho ổn định.
export function sortMaterials(
  metas: MaterialMeta[],
  sort: SortKey
): MaterialMeta[] {
  const byNewest = (a: MaterialMeta, b: MaterialMeta) =>
    b.createdAtMs - a.createdAtMs;
  const sorted = [...metas];
  switch (sort) {
    case "title":
      sorted.sort((a, b) => compareTitles(a.title, b.title) || byNewest(a, b));
      break;
    case "questions":
      sorted.sort(
        (a, b) => b.questionCount - a.questionCount || byNewest(a, b)
      );
      break;
    case "parts":
      sorted.sort((a, b) => b.unitCount - a.unitCount || byNewest(a, b));
      break;
    case "assigned":
      sorted.sort(
        (a, b) =>
          (b.lastAssignedAtMs ?? 0) - (a.lastAssignedAtMs ?? 0) ||
          byNewest(a, b)
      );
      break;
    case "newest":
    default:
      sorted.sort(byNewest);
      break;
  }
  return sorted;
}

export type BookShelf = {
  name: string;
  skills: string[];
  count: number;
  practiceOpenCount: number;
};

const SKILL_ORDER = ["listening", "reading", "writing", "speaking"];

// Gom đề loại "sách" thành các kệ theo tên sách (series). Kệ chưa đặt tên xuống cuối.
export function groupBookShelves(metas: MaterialMeta[]): BookShelf[] {
  const shelves = new Map<
    string,
    { skills: Set<string>; count: number; practiceOpenCount: number }
  >();
  for (const meta of metas) {
    if (meta.category !== "book") continue;
    const shelf = shelves.get(meta.series) ?? {
      skills: new Set<string>(),
      count: 0,
      practiceOpenCount: 0
    };
    shelf.skills.add(meta.skill);
    shelf.count += 1;
    if (meta.practiceOpen) shelf.practiceOpenCount += 1;
    shelves.set(meta.series, shelf);
  }
  return Array.from(shelves, ([name, shelf]) => ({
    name,
    skills: SKILL_ORDER.filter((skill) => shelf.skills.has(skill)),
    count: shelf.count,
    practiceOpenCount: shelf.practiceOpenCount
  })).sort((a, b) => {
    if (a.name === UNNAMED_SHELF) return 1;
    if (b.name === UNNAMED_SHELF) return -1;
    return a.name.localeCompare(b.name, "vi", { numeric: true });
  });
}

export function filterAndSortMaterials(
  metas: MaterialMeta[],
  filters: MaterialFilters
): MaterialMeta[] {
  return sortMaterials(filterMaterials(metas, filters), filters.sort);
}
