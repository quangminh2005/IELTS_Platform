import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), "utf8");
}

// Thanh nghe lại ở trang kết quả chỉ chạy khi audioUrl đi được từ DB xuống
// component. Bốn chốt dưới đây là các mắt nối dễ bị bỏ sót nhất.
describe("nghe lại bài nghe ở trang kết quả", () => {
  it("cả hai trang kết quả đều lấy audioUrl của phần", () => {
    for (const path of [
      "app/student/results/[attemptId]/page.tsx",
      "app/teacher/results/[attemptId]/page.tsx"
    ]) {
      expect(readProjectFile(path)).toContain("audioUrl: true");
    }
  });

  it("ResultPart mang audioUrl và ResultReview chỉ gán cho phần listening", () => {
    expect(readProjectFile("components/result-answers.tsx")).toMatch(
      /export type ResultPart = \{[\s\S]*?audioUrl: string \| null;/
    );
    expect(readProjectFile("components/result-review.tsx")).toContain(
      'audioUrl: unit.skill === "listening" ? unit.audioUrl ?? null : null'
    );
  });

  it("thanh phát remount theo phần để không phát chồng hai part", () => {
    const source = readProjectFile("components/result-answers.tsx");
    expect(source).toContain("key={part.unitId}");
    expect(source).toContain("showSpeed");
  });

  it("nút tốc độ là tùy chọn nên thanh audio lúc thi vẫn không có", () => {
    const player = readProjectFile("components/audio-player.tsx");
    expect(player).toContain("showSpeed = false");
    // Trang làm bài chỉ truyền src/autoPlay, không bật showSpeed.
    expect(readProjectFile("components/attempt-workspace.tsx")).not.toContain(
      "<AudioPlayer showSpeed"
    );
  });
});
