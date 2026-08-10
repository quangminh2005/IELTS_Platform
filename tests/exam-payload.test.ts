import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { examUnitsForStudent } from "@/lib/exam-payload";

const root = process.cwd();

// Một dòng AssignmentUnit y như Prisma trả về ở trang làm bài: KÈM đáp án đúng,
// giải thích, dẫn chứng và transcript — đúng những thứ không được rời khỏi server
// trong lúc học viên đang thi.
function rawUnit() {
  return {
    id: "au-1",
    assignmentId: "as-1",
    assignableUnitId: "u-1",
    order: 1,
    customTimeLimitMinutes: null,
    createdAt: new Date(),
    assignableUnit: {
      id: "u-1",
      materialId: "m-1",
      unitNumber: 1,
      skill: "listening",
      unitType: "listening_part",
      title: "Part 1",
      instructions: "Write ONE WORD only.",
      content: "Nội dung phần nghe",
      audioUrl: "https://blob/audio.mp3",
      transcript: "BÍ MẬT: toàn bộ lời thoại bài nghe",
      transcriptTimingJson: "[]",
      defaultTimeLimitMinutes: 30,
      metadataJson: "{}",
      createdAt: new Date(),
      questions: [
        {
          id: "q-1",
          assignableUnitId: "u-1",
          order: 1,
          questionType: "short_answer",
          prompt: "The library opens at [[1]].",
          optionsJson: null,
          correctAnswerJson: JSON.stringify(["9am"]),
          explanation: "BÍ MẬT: giải thích đáp án",
          answerEvidence: "BÍ MẬT: dẫn chứng trong bài",
          points: 1,
          createdAt: new Date()
        }
      ]
    }
  };
}

describe("dữ liệu đề gửi xuống trình duyệt học viên", () => {
  it("không kèm đáp án đúng, giải thích, dẫn chứng hay transcript", () => {
    const serialized = JSON.stringify(examUnitsForStudent([rawUnit()]));

    expect(serialized).not.toContain("9am");
    expect(serialized).not.toContain("BÍ MẬT");
    expect(serialized).not.toContain("correctAnswerJson");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain("answerEvidence");
    expect(serialized).not.toContain("transcriptTimingJson");
  });

  it("giữ đủ những gì phòng làm bài cần để render đề", () => {
    const [unit] = examUnitsForStudent([rawUnit()]);

    expect(unit.id).toBe("au-1");
    expect(unit.order).toBe(1);
    expect(unit.customTimeLimitMinutes).toBeNull();
    expect(unit.assignableUnit).toMatchObject({
      id: "u-1",
      skill: "listening",
      unitType: "listening_part",
      title: "Part 1",
      instructions: "Write ONE WORD only.",
      content: "Nội dung phần nghe",
      audioUrl: "https://blob/audio.mp3",
      defaultTimeLimitMinutes: 30,
      metadataJson: "{}"
    });
    // Kiểu prop của <AttemptWorkspace> đòi có transcript — để null chứ không bỏ hẳn.
    expect(unit.assignableUnit.transcript).toBeNull();
    expect(unit.assignableUnit.questions).toEqual([
      {
        id: "q-1",
        order: 1,
        questionType: "short_answer",
        prompt: "The library opens at [[1]].",
        optionsJson: null,
        points: 1
      }
    ]);
  });

  it("không hỏng khi bài giao không có phần nào", () => {
    expect(examUnitsForStudent([])).toEqual([]);
  });
});

// Lưới an toàn ở tầng trang: Next serialize TOÀN BỘ prop của client component vào
// RSC payload, kể cả field component không dùng. Truyền thẳng object Prisma xuống
// <AttemptWorkspace> là lộ đáp án — trang bắt buộc phải đi qua examUnitsForStudent.
describe("trang làm bài của học viên", () => {
  const page = readFileSync(
    join(root, "app", "student", "assignments", "[recipientId]", "page.tsx"),
    "utf8"
  );

  it("lọc đề qua examUnitsForStudent trước khi truyền xuống client", () => {
    expect(page).toContain("examUnitsForStudent");
  });

  it("không truyền thẳng assignment lấy từ Prisma xuống AttemptWorkspace", () => {
    expect(page).not.toMatch(/assignment=\{recipient\.assignment\}/);
  });
});
