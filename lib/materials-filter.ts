// Logic thuần cho bộ lọc Kho đề (search / filter / sort / tag trạng thái).
// Tách khỏi UI để unit-test dễ dàng (xem tests/materials-filter.test.ts).

export type SortKey = "newest" | "questions" | "parts" | "assigned";

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
};

export type PracticeFilter = "all" | "open";

export type MaterialFilters = {
  search: string;
  skill: string; // "all" hoặc một kỹ năng
  series: string; // "all" hoặc tên bộ sách
  status: StatusFilter;
  practice: PracticeFilter; // "all" hoặc "open"
  sort: SortKey;
};

export const defaultMaterialFilters: MaterialFilters = {
  search: "",
  skill: "all",
  series: "all",
  status: "all",
  practice: "all",
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
    if (filters.skill !== "all" && meta.skill !== filters.skill) return false;
    if (filters.series !== "all" && meta.series !== filters.series) return false;
    if (filters.practice === "open" && !meta.practiceOpen) return false;
    if (!matchesStatus(meta, filters.status)) return false;
    return true;
  });
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

export function filterAndSortMaterials(
  metas: MaterialMeta[],
  filters: MaterialFilters
): MaterialMeta[] {
  return sortMaterials(filterMaterials(metas, filters), filters.sort);
}
