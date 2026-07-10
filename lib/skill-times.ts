// Gộp thời gian làm bài theo phần (assignableUnitId) thành thời gian theo kỹ năng.
//
// Attempt.partTimesJson lưu chuỗi JSON dạng { [assignableUnitId]: số giây }. Học
// sinh làm phần nào thì thời gian đồng hồ cộng dồn vào phần đó. Ở trang kết quả ta
// tra kỹ năng của từng phần rồi cộng các phần cùng kỹ năng lại (vd 3 passage Reading
// gộp thành tổng thời gian Reading).

// Thứ tự hiển thị các kỹ năng cho nhất quán giữa các trang.
export const SKILL_TIME_ORDER = ["listening", "reading", "writing", "speaking"] as const;

// Nhãn ngắn cho dòng gộp ở header (giữ tên tiếng Anh của kỹ năng như đề thi).
export const SKILL_TIME_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking"
};

// Đọc partTimesJson thành map an toàn: bỏ qua khóa lỗi, giá trị âm/không phải số.
// Null / chuỗi rỗng / JSON hỏng đều trả về {} (không làm vỡ trang kết quả).
export function parsePartTimes(json: string | null | undefined): Record<string, number> {
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
      const seconds = Number(value);
      if (key && Number.isFinite(seconds) && seconds >= 0) {
        result[key] = Math.floor(seconds);
      }
    }
    return result;
  } catch {
    return {};
  }
}

// Chuẩn hóa lại partTimesJson trước khi ghi DB: chỉ giữ dữ liệu hợp lệ; nếu rỗng
// thì trả về null để bài đó coi như "không có dữ liệu thời gian theo phần".
export function sanitizePartTimesJson(json: string | null | undefined): string | null {
  const parsed = parsePartTimes(json);
  return Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : null;
}

// Gộp partTimesJson (theo phần) thành thời gian theo kỹ năng, dựa vào bảng
// unitSkills: assignableUnitId -> skill. Phần không tra được kỹ năng bị bỏ qua.
export function skillTimesFromParts(
  json: string | null | undefined,
  unitSkills: Record<string, string>
): Record<string, number> {
  const partTimes = parsePartTimes(json);
  const skillTimes: Record<string, number> = {};

  for (const [unitId, seconds] of Object.entries(partTimes)) {
    const skill = unitSkills[unitId];
    if (!skill) {
      continue;
    }
    skillTimes[skill] = (skillTimes[skill] ?? 0) + seconds;
  }

  return skillTimes;
}

// Sắp xếp map thời-gian-theo-kỹ-năng thành danh sách có thứ tự ổn định để hiển thị.
export function orderedSkillTimes(
  skillTimes: Record<string, number>
): Array<{ skill: string; seconds: number }> {
  return Object.entries(skillTimes)
    .map(([skill, seconds]) => ({ skill, seconds }))
    .sort((a, b) => {
      const ia = SKILL_TIME_ORDER.indexOf(a.skill as (typeof SKILL_TIME_ORDER)[number]);
      const ib = SKILL_TIME_ORDER.indexOf(b.skill as (typeof SKILL_TIME_ORDER)[number]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}
