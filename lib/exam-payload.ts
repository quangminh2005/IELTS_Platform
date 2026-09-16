// Lọc đề trước khi gửi xuống trình duyệt học viên.
//
// VÌ SAO CẦN HÀM NÀY: <AttemptWorkspace> là client component, mà Next serialize
// TOÀN BỘ prop của client component vào RSC payload — kể cả field component
// không hề đọc tới. Truyền thẳng object Prisma (include: { questions: true })
// xuống là đáp án đúng, giải thích, dẫn chứng và cả transcript bài Nghe nằm
// nguyên văn trong HTML: học viên bấm Ctrl+U lúc đang thi là thấy hết.
//
// Chấm điểm nằm hoàn toàn ở server (submitSkill đọc lại đáp án từ DB) nên phòng
// làm bài không cần những trường này. Trang xem trước của giáo viên thì vẫn
// truyền đủ — ở đó lộ đáp án là đúng ý đồ.

import { computeNoteLineTimes, type LineTime } from "@/lib/dictation-steps";
import { parseQuestionOptions, parseUnitMetaFlag, parseUnitMetaString } from "@/lib/question-interactions";

// Chỉ khai báo những trường hàm này ĐỌC, không phải toàn bộ cột của Prisma —
// nhờ vậy nhận thẳng kết quả query mà không cần ép kiểu.
type RawAssignmentUnit = {
  id: string;
  order: number;
  customTimeLimitMinutes: number | null;
  assignableUnit: {
    id: string;
    skill: string;
    unitType: string;
    title: string;
    instructions: string | null;
    content: string;
    audioUrl: string | null;
    // Chỉ đọc ở server để tính mốc giờ từng dòng cho chế độ làm từng bước
    // (metadata.stepMode) — KHÔNG đi xuống client.
    transcript?: string | null;
    transcriptTimingJson?: string | null;
    defaultTimeLimitMinutes: number | null;
    metadataJson: string | null;
    questions: Array<{
      id: string;
      order: number;
      questionType: string;
      prompt: string;
      optionsJson: string | null;
      correctAnswerJson?: string | null;
      points: number;
    }>;
  };
};

// Mốc [giây bắt đầu, giây kết thúc] của từng dòng noteBody — chỉ có ở unit bật
// stepMode và có transcript đã đồng bộ mốc giờ. Toàn số nên gửi xuống client an toàn.
export function noteLineTimesForUnit(
  unit: RawAssignmentUnit["assignableUnit"]
): Array<LineTime | null> | null {
  if (!parseUnitMetaFlag(unit.metadataJson, "stepMode")) {
    return null;
  }
  const noteBody = parseUnitMetaString(unit.metadataJson, "noteBody");
  if (!noteBody || !unit.transcriptTimingJson) {
    return null;
  }
  const answersByOrder: Record<number, string> = {};
  unit.questions.forEach((question) => {
    const [first] = parseQuestionOptions(question.correctAnswerJson);
    if (first) {
      answersByOrder[question.order] = first;
    }
  });
  return computeNoteLineTimes({
    noteBody,
    answersByOrder,
    transcript: unit.transcript,
    transcriptTimingJson: unit.transcriptTimingJson
  });
}

export type ExamUnitForStudent = {
  id: string;
  order: number;
  customTimeLimitMinutes: number | null;
  assignableUnit: {
    id: string;
    skill: string;
    unitType: string;
    title: string;
    instructions: string | null;
    content: string;
    audioUrl: string | null;
    // Luôn null khi đang làm bài. Giữ lại field vì prop của <AttemptWorkspace>
    // đòi có (phòng xem trước của giáo viên dùng chung component đó).
    transcript: null;
    defaultTimeLimitMinutes: number | null;
    metadataJson: string | null;
    noteLineTimes: Array<LineTime | null> | null;
    questions: Array<{
      id: string;
      order: number;
      questionType: string;
      prompt: string;
      optionsJson: string | null;
      points: number;
    }>;
  };
};

export function examUnitsForStudent(units: RawAssignmentUnit[]): ExamUnitForStudent[] {
  return units.map((assignmentUnit) => {
    const unit = assignmentUnit.assignableUnit;

    return {
      id: assignmentUnit.id,
      order: assignmentUnit.order,
      customTimeLimitMinutes: assignmentUnit.customTimeLimitMinutes,
      assignableUnit: {
        id: unit.id,
        skill: unit.skill,
        unitType: unit.unitType,
        title: unit.title,
        instructions: unit.instructions,
        content: unit.content,
        audioUrl: unit.audioUrl,
        transcript: null,
        defaultTimeLimitMinutes: unit.defaultTimeLimitMinutes,
        metadataJson: unit.metadataJson,
        noteLineTimes: noteLineTimesForUnit(unit),
        questions: unit.questions.map((question) => ({
          id: question.id,
          order: question.order,
          questionType: question.questionType,
          prompt: question.prompt,
          optionsJson: question.optionsJson,
          points: question.points
        }))
      }
    };
  });
}
