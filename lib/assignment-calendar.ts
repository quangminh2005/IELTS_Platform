// Kiểu dữ liệu và hàm thuần cho màn hình "Lịch giao bài" của giáo viên.
// Toàn bộ ở đây không phụ thuộc Prisma/React để test được và dùng chung
// cho cả server component lẫn client component.

import { bandsBySkill, formatBand, SKILL_SHORT_LABELS } from "@/lib/band-score";
import { distinctSkills } from "@/lib/skills";

export type CalendarClass = { id: string; name: string };

// Tiến độ MỘT kỹ năng trong một lần làm bài đang dở.
// correct/total/band = null khi chưa nộp, hoặc khi là kỹ năng chấm tay (Viết/Nói).
export type CalendarSkillProgress = {
  skill: string;
  submitted: boolean;
  correct: number | null;
  total: number | null;
  band: number | null;
};

export type CalendarAttempt = {
  id: string;
  status: string; // in_progress | submitted | reviewed
  submittedAt: string | null; // ISO
  elapsedSeconds: number;
  tabSwitchCount: number;
  findAttemptCount: number;
  band: number | null;
  correct: number;
  total: number;
  scorePercent: number | null;
  hasPendingManual: boolean; // còn câu Writing/Speaking chưa chấm
  skills: CalendarSkillProgress[]; // tiến độ từng kỹ năng của bài
};

export type CalendarRecipient = {
  studentId: string;
  displayName: string;
  email: string;
  classIds: string[];
  status: string; // assigned | in_progress | submitted | reviewed
  attempt: CalendarAttempt | null;
};

export type CalendarAssignment = {
  id: string;
  title: string;
  createdAt: string; // ISO
  deadline: string | null; // ISO
  unitCount: number;
  // Kỹ năng có trong bài (lấy từ các phần được giao), đã sắp thứ tự IELTS.
  skills: string[];
  recipients: CalendarRecipient[];
};

export type CalendarMode = "assigned" | "deadline";

export type ClassGroup = {
  classId: string | null;
  className: string;
  students: CalendarRecipient[];
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// 'YYYY-MM-DD' theo lịch Việt Nam (UTC+7) từ một mốc ISO.
export function vnDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// Gom bài vào từng ngày. Chế độ "deadline" bỏ qua bài không có hạn nộp.
export function bucketAssignmentsByDay(
  assignments: CalendarAssignment[],
  mode: CalendarMode
): Map<string, CalendarAssignment[]> {
  const map = new Map<string, CalendarAssignment[]>();

  for (const assignment of assignments) {
    const anchor = mode === "deadline" ? assignment.deadline : assignment.createdAt;
    if (!anchor) {
      continue;
    }
    const key = vnDayKey(anchor);
    const list = map.get(key) ?? [];
    list.push(assignment);
    map.set(key, list);
  }

  return map;
}

// Nộp trễ hạn: logic nằm ở lib/late-submission.ts (dùng chung với đường tính
// điểm xếp hạng). Re-export ở đây để các trang giáo viên đang import từ module
// lịch không phải sửa.
export { isSubmissionLate } from "@/lib/late-submission";

// Đếm câu đã chấm tự động (Nghe/Đọc). Bỏ câu Writing/Speaking (isCorrect null).
export function countGradedAnswers(
  answers: Array<{ isCorrect: boolean | null }>
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;

  for (const answer of answers) {
    if (answer.isCorrect === null) {
      continue;
    }
    total += 1;
    if (answer.isCorrect) {
      correct += 1;
    }
  }

  return { correct, total };
}

// Tiến độ từng kỹ năng của một lần làm bài đang dở, để trang Lịch giao bài cho
// biết học viên đã xong phần nào. Ghép ba nguồn:
//   - assignmentSkills: kỹ năng CỦA BÀI (đã sắp thứ tự IELTS). Lấy từ bài chứ
//     không từ attemptSkills, vì AttemptSkill chỉ sinh ra khi học sinh mở kỹ năng
//     đó — kỹ năng chưa đụng tới vẫn phải hiện "chưa nộp".
//   - attemptSkills: trạng thái nộp; không có dòng => coi như chưa nộp.
//   - answers: số câu đúng + band (bandsBySkill chỉ trả về Nghe/Đọc, nên Viết/Nói
//     đã nộp sẽ không có điểm — phía hiển thị ghi "chờ chấm").
export function buildSkillProgress(
  assignmentSkills: string[],
  attemptSkills: Array<{ skill: string; status: string }>,
  answers: Array<{ isCorrect: boolean | null; skill: string }>
): CalendarSkillProgress[] {
  const statusBySkill = new Map(attemptSkills.map((row) => [row.skill, row.status]));
  const bandBySkill = new Map(bandsBySkill(answers).map((row) => [row.skill, row]));

  return assignmentSkills.map((skill) => {
    const submitted = statusBySkill.get(skill) === "submitted";
    const scored = submitted ? bandBySkill.get(skill) : undefined;

    return {
      skill,
      submitted,
      correct: scored?.correct ?? null,
      total: scored?.total ?? null,
      band: scored?.band ?? null
    };
  });
}

// Chữ trên chip tiến độ một kỹ năng: "Nghe: 20/40 · Band 5.5", "Viết: đã nộp ·
// chờ chấm" (kỹ năng chấm tay), hay "Đọc: chưa nộp".
export function skillChipText(progress: CalendarSkillProgress): string {
  const label = SKILL_SHORT_LABELS[progress.skill] ?? progress.skill;

  if (!progress.submitted) {
    return `${label}: chưa nộp`;
  }
  if (progress.correct === null || progress.total === null) {
    return `${label}: đã nộp · chờ chấm`;
  }

  const score = `${label}: ${progress.correct}/${progress.total}`;
  return progress.band === null ? score : `${score} · Band ${formatBand(progress.band)}`;
}

// Gom học viên theo lớp. Lọc theo 1 lớp -> chỉ lớp đó. "Tất cả" -> mỗi lớp có
// học viên nhận bài là một nhóm; học viên không thuộc lớp nào vào "Chưa xếp lớp".
// Học viên thuộc nhiều lớp sẽ xuất hiện ở mỗi nhóm lớp của họ (phản ánh đúng "theo lớp").
export function studentsGroupedByClass(
  recipients: CalendarRecipient[],
  classes: CalendarClass[],
  selectedClassId: string | null
): ClassGroup[] {
  if (selectedClassId) {
    const cls = classes.find((item) => item.id === selectedClassId);
    const students = recipients.filter((r) => r.classIds.includes(selectedClassId));
    return students.length > 0
      ? [{ classId: selectedClassId, className: cls?.name ?? "Lớp", students }]
      : [];
  }

  const groups: ClassGroup[] = [];
  for (const cls of classes) {
    const students = recipients.filter((r) => r.classIds.includes(cls.id));
    if (students.length > 0) {
      groups.push({ classId: cls.id, className: cls.name, students });
    }
  }

  const unassigned = recipients.filter(
    (r) => !classes.some((cls) => r.classIds.includes(cls.id))
  );
  if (unassigned.length > 0) {
    groups.push({ classId: null, className: "Chưa xếp lớp", students: unassigned });
  }

  return groups;
}

// Chuỗi "kết quả" hiển thị: band (hoặc %) + số câu đúng; kèm/hiện "Chờ chấm" cho
// phần chấm tay. Chỉ dùng cho attempt đã nộp/đã chấm.
export function formatAttemptResult(attempt: {
  band: number | null;
  correct: number;
  total: number;
  scorePercent: number | null;
  hasPendingManual: boolean;
  status: string;
}): string {
  if (attempt.status !== "submitted" && attempt.status !== "reviewed") {
    return "—";
  }

  if (attempt.total > 0) {
    const head =
      attempt.band !== null
        ? formatBand(attempt.band)
        : attempt.scorePercent !== null
          ? `${Math.round(attempt.scorePercent)}%`
          : "—";
    const body = `${head} · ${attempt.correct}/${attempt.total}`;
    return attempt.hasPendingManual ? `${body} · Chờ chấm` : body;
  }

  if (attempt.band !== null) {
    return formatBand(attempt.band);
  }
  return "Chờ chấm";
}

// Gom bài theo ngày rồi trả về danh sách ngày sắp xếp giảm dần (mới nhất trước),
// dùng cho màn danh sách bài theo ngày của giáo viên.
export function groupAssignmentsByDayDescending(
  assignments: CalendarAssignment[],
  mode: CalendarMode
): Array<{ dayKey: string; assignments: CalendarAssignment[] }> {
  const map = bucketAssignmentsByDay(assignments, mode);

  return [...map.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((dayKey) => ({ dayKey, assignments: map.get(dayKey) ?? [] }));
}

// ---------------------------------------------------------------------------
// Nhãn & trạng thái hiển thị của một thẻ bài trên Lịch giao bài.
// Toàn bộ là hàm thuần để test được và để client component chỉ lo dựng giao diện.
// ---------------------------------------------------------------------------

// Bỏ dấu tiếng Việt + hạ chữ thường, để dò từ khóa trong tiêu đề bài.
function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");
}

const SKILL_TITLE_PATTERNS: Array<{ skill: string; pattern: RegExp }> = [
  { skill: "listening", pattern: /\b(listening|nghe)\b/ },
  { skill: "reading", pattern: /\b(reading|doc hieu|doc)\b/ },
  { skill: "writing", pattern: /\b(writing|viet|essay|task [12])\b/ },
  { skill: "speaking", pattern: /\b(speaking|noi)\b/ }
];

const MOCK_TEST_PATTERN = /(kiem tra dinh ky|kiem tra|thi thu|mock test|mock|full test|mini test|de thi)/;

// Đoán kỹ năng từ tiêu đề — chỉ dùng khi bài không kèm dữ liệu kỹ năng thật.
export function assignmentTitleSkills(title: string): string[] {
  const text = normalizeTitle(title);
  return SKILL_TITLE_PATTERNS.filter((item) => item.pattern.test(text)).map(
    (item) => item.skill
  );
}

// Bài kiểm tra định kỳ / thi thử? Chỉ dựa vào tiêu đề vì dữ liệu không có cờ này.
export function isMockTestAssignment(title: string): boolean {
  return MOCK_TEST_PATTERN.test(normalizeTitle(title));
}

// Kỹ năng để gắn badge cho một bài: ưu tiên kỹ năng thật của các phần trong bài,
// không có thì mới đoán theo tiêu đề.
export function assignmentSkillTags(assignment: {
  title: string;
  skills?: string[];
}): string[] {
  const fromUnits = distinctSkills(assignment.skills ?? []);
  if (fromUnits.length > 0) {
    return fromUnits;
  }
  return distinctSkills(assignmentTitleSkills(assignment.title));
}

// Mức độ nộp bài của cả lớp: xong hết / đang nộp dở / còn ít người nộp.
export type SubmissionLevel = "done" | "progress" | "low";

export function submissionProgress(
  submitted: number,
  total: number
): { percent: number; level: SubmissionLevel } {
  if (total <= 0) {
    return { percent: 0, level: "low" };
  }
  const percent = Math.round((submitted / total) * 100);
  if (submitted >= total) {
    return { percent: 100, level: "done" };
  }
  return { percent, level: percent >= 50 ? "progress" : "low" };
}

// Trạng thái hạn nộp để đổi màu nhãn. nowMs = null (chưa gắn xong ở trình duyệt)
// thì coi như còn hạn, tránh lệch giữa server và client.
export type DeadlineState = "none" | "due" | "overdue";

export function deadlineState(
  deadline: string | null,
  nowMs: number | null
): DeadlineState {
  if (!deadline) {
    return "none";
  }
  if (nowMs === null) {
    return "due";
  }
  return new Date(deadline).getTime() < nowMs ? "overdue" : "due";
}
