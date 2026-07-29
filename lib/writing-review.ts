// Chấm tay Writing/Speaking: bộ tiêu chí, band từng phần và band tổng.
//
// Vì sao tách riêng file: một lần nộp Writing có thể chứa NHIỀU bài luận (Task 1
// + Task 2). Mỗi bài phải có bộ 4 tiêu chí riêng, và band tổng của Writing tính
// theo trọng số Task 1 : Task 2 = 1 : 2 (quy tắc IELTS) chứ KHÔNG phải trung
// bình cộng. Speaking thì ngược lại: cả 3 part chỉ chấm một bộ tiêu chí duy nhất.

export type Criterion = {
  key: string;
  label: string;
};

// Bốn tiêu chí chấm của IELTS, khác nhau giữa Writing và Speaking.
export const WRITING_CRITERIA: Criterion[] = [
  { key: "taskAchievement", label: "Task Achievement / Response" },
  { key: "coherence", label: "Coherence & Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" }
];

export const SPEAKING_CRITERIA: Criterion[] = [
  { key: "fluency", label: "Fluency & Coherence" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" },
  { key: "pronunciation", label: "Pronunciation" }
];

// Các mức band hợp lệ: 0 → 9, bước 0.5.
export const BAND_OPTIONS = Array.from({ length: 19 }, (_, index) => index * 0.5);

export function criteriaForSkill(skill: string): Criterion[] {
  return skill === "speaking" ? SPEAKING_CRITERIA : WRITING_CRITERIA;
}

// Đọc lại bản ghi cũ: đoán bộ tiêu chí theo tên khoá đã lưu (Speaking có
// "fluency"/"pronunciation", Writing thì không).
export function criteriaForScores(scores: TaskScores): Criterion[] {
  return "fluency" in scores || "pronunciation" in scores
    ? SPEAKING_CRITERIA
    : WRITING_CRITERIA;
}

export type TaskScores = Record<string, number>;

// Một "phần chấm": với Writing là một bài luận (một AssignableUnit), với Speaking
// là cả lần nộp (unitId rỗng).
export type ReviewTask = {
  unitId: string;
  label: string;
  // 1 hoặc 2 nếu nhận ra được Task 1 / Task 2, null nếu không chắc.
  taskNumber: number | null;
  scores: TaskScores;
};

// Làm tròn về 0.5 gần nhất — đúng luật IELTS: .25 lên .5, .75 lên số nguyên kế.
export function roundToHalfBand(value: number): number {
  return Math.round(value * 2) / 2;
}

// Band của một phần = trung bình 4 tiêu chí, làm tròn 0.5. Thiếu bất kỳ tiêu chí
// nào thì chưa tính (null) — không lấy trung bình của 2-3 tiêu chí.
export function taskBand(scores: TaskScores, criteria: Criterion[]): number | null {
  if (criteria.length === 0) {
    return null;
  }

  const values = criteria
    .map((criterion) => scores[criterion.key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length !== criteria.length) {
    return null;
  }

  return roundToHalfBand(values.reduce((total, value) => total + value, 0) / criteria.length);
}

// Chỉ áp trọng số 1:2 khi nhận ra CHÍNH XÁC một Task 1 và một Task 2. Mọi trường
// hợp còn lại (một bài, hai bài cùng loại, không đoán được) chia đều — thà lấy
// trung bình cộng còn hơn nhân sai trọng số cho đề tự biên.
export function taskWeights(tasks: Pick<ReviewTask, "taskNumber">[]): {
  weights: number[];
  weighted: boolean;
} {
  const numbers = tasks.map((task) => task.taskNumber);
  const weighted =
    tasks.length === 2 && numbers.includes(1) && numbers.includes(2);

  return {
    weights: weighted ? numbers.map((number) => (number === 2 ? 2 : 1)) : tasks.map(() => 1),
    weighted
  };
}

export type OverallBand = {
  band: number | null;
  // true = đã nhân trọng số Task 1 : Task 2 = 1 : 2.
  weighted: boolean;
};

export function overallBandFromTasks(
  tasks: ReviewTask[],
  criteria: Criterion[]
): OverallBand {
  const { weights, weighted } = taskWeights(tasks);
  const bands: number[] = [];

  for (const task of tasks) {
    const band = taskBand(task.scores, criteria);
    // Còn phần nào chưa chấm đủ 4 tiêu chí thì chưa có band tổng.
    if (band === null) {
      return { band: null, weighted };
    }
    bands.push(band);
  }

  if (bands.length === 0) {
    return { band: null, weighted };
  }

  const total = bands.reduce((sum, band, index) => sum + band * weights[index], 0);
  const divisor = weights.reduce((sum, weight) => sum + weight, 0);

  return { band: roundToHalfBand(total / divisor), weighted };
}

function toScores(value: unknown): TaskScores {
  if (!value || typeof value !== "object") {
    return {};
  }

  const scores: TaskScores = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const number = Number(raw);
    if (Number.isFinite(number)) {
      scores[key] = number;
    }
  }

  return scores;
}

// criteriaScoresJson có hai dạng:
//   - cũ (một phần):  {"taskAchievement": 6, "coherence": 6, ...}
//   - mới (nhiều phần): {"version": 2, "tasks": [{unitId, label, taskNumber, scores}]}
// Dạng cũ vẫn được ghi lại khi chỉ có MỘT phần, để bản ghi cũ và mới đọc lẫn nhau.
export function parseReviewCriteria(json: string | null | undefined): ReviewTask[] {
  if (!json) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const rawTasks = (parsed as { tasks?: unknown }).tasks;

  if (Array.isArray(rawTasks)) {
    return rawTasks
      .map((raw) => {
        const task = (raw ?? {}) as Record<string, unknown>;
        const taskNumber = Number(task.taskNumber);

        return {
          unitId: typeof task.unitId === "string" ? task.unitId : "",
          label: typeof task.label === "string" ? task.label : "",
          taskNumber: taskNumber === 1 || taskNumber === 2 ? taskNumber : null,
          scores: toScores(task.scores)
        };
      })
      .filter((task) => Object.keys(task.scores).length > 0);
  }

  const scores = toScores(parsed);

  return Object.keys(scores).length > 0
    ? [{ unitId: "", label: "", taskNumber: null, scores }]
    : [];
}

export function serializeReviewCriteria(tasks: ReviewTask[]): string {
  const kept = tasks.filter((task) => Object.keys(task.scores).length > 0);

  if (kept.length === 0) {
    return "";
  }

  // Một phần duy nhất → giữ nguyên dạng phẳng cũ (Speaking, hoặc bài chỉ có một
  // Task Writing). Nhãn phần lúc này thừa vì màn kết quả chỉ có một bài để hiện.
  if (kept.length === 1) {
    return JSON.stringify(kept[0].scores);
  }

  return JSON.stringify({
    version: 2,
    tasks: kept.map((task) => ({
      unitId: task.unitId,
      label: task.label,
      taskNumber: task.taskNumber,
      scores: task.scores
    }))
  });
}

// Đoán số task của một phần Writing: ưu tiên chữ "Task 1"/"Task 2" trong tên
// phần (đề Cambridge luôn ghi rõ), không có thì lấy unitNumber nếu là 1 hoặc 2.
export function resolveWritingTaskNumber(
  title: string | null | undefined,
  unitNumber: number | null | undefined
): number | null {
  const matched = /\btask\s*([12])\b/i.exec(title ?? "");
  if (matched) {
    return Number(matched[1]);
  }

  if (unitNumber === 1 || unitNumber === 2) {
    return unitNumber;
  }

  return null;
}
