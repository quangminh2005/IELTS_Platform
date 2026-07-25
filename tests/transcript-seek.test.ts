import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), "utf8");
}

// Bấm câu trong transcript -> tua audio: các mắt nối dữ liệu + hành vi dễ đứt.
describe("bấm transcript để tua audio ở trang kết quả", () => {
  it("schema và ensure-db đều có cột transcriptTimingJson", () => {
    expect(readProjectFile("prisma/schema.prisma")).toMatch(
      /model AssignableUnit \{[\s\S]*?transcriptTimingJson\s+String\?/
    );
    expect(readProjectFile("scripts/ensure-db.mjs")).toContain(
      '"AssignableUnit" ADD COLUMN IF NOT EXISTS "transcriptTimingJson"'
    );
  });

  it("cả hai trang kết quả và phòng xem trước đều lấy transcriptTimingJson", () => {
    for (const path of [
      "app/student/results/[attemptId]/page.tsx",
      "app/teacher/results/[attemptId]/page.tsx",
      "app/teacher/materials/[materialId]/preview/page.tsx"
    ]) {
      expect(readProjectFile(path)).toContain("transcriptTimingJson");
    }
  });

  it("ResultPart mang transcriptTimingJson và ResultReview chỉ gán cho listening", () => {
    expect(readProjectFile("components/result-answers.tsx")).toMatch(
      /export type ResultPart = \{[\s\S]*?transcriptTimingJson: string \| null;/
    );
    expect(readProjectFile("components/result-review.tsx")).toMatch(
      /transcriptTimingJson:\s*\n?\s*unit\.skill === "listening" \? unit\.transcriptTimingJson \?\? null : null/
    );
  });

  it("AudioPlayer nhận controlRef tùy chọn nhưng trang làm bài KHÔNG truyền", () => {
    expect(readProjectFile("components/audio-player.tsx")).toContain("controlRef?:");
    // Trang làm bài giữ hành vi thi thật: không có điều khiển tua từ ngoài.
    expect(readProjectFile("components/attempt-workspace.tsx")).not.toContain("controlRef=");
  });

  it("lưu/import phần nghe có gọi đồng bộ mốc thời gian", () => {
    const actions = readProjectFile("lib/actions/materials.ts");
    expect(actions).toContain("syncTranscriptTiming");
    // Audio/transcript đổi thì mốc cũ phải bị xóa để không tua sai chỗ.
    expect(actions).toContain("transcriptTimingJson: null");
  });

  it("đồng bộ từ chối lưu khi audio và transcript khớp quá thấp", () => {
    const sync = readProjectFile("lib/transcript-sync.ts");
    expect(sync).toContain("MIN_MATCH_RATIO");
    expect(sync).toContain("timestamp_granularities[]");
  });
});
