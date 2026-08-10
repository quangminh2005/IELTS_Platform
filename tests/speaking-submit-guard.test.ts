import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const recorder = readFileSync(
  join(root, "components", "audio-recorder-answer.tsx"),
  "utf8"
);
const workspace = readFileSync(join(root, "components", "attempt-workspace.tsx"), "utf8");

// Ngày 9/8/2026 hai học viên nộp bài Speaking mà không có bản ghi nào lên tới
// Blob. Màn làm bài lúc đó cho bấm "Nộp bài" ngay cả khi đang ghi âm (bản ghi
// chưa chốt nên không bao giờ upload) hoặc khi bản ghi đang tải lên — mất trắng
// mà không báo gì. Bộ test này giữ chốt chặn đó.
describe("chốt chặn nộp bài khi đang ghi âm", () => {
  it("AudioRecorderAnswer báo trạng thái bận ra ngoài", () => {
    expect(recorder).toContain("onBusyChange");
    // Báo đủ cả hai giai đoạn: đang ghi và đang tải lên.
    expect(recorder).toMatch(/onBusyChange[\s\S]{0,400}"recording"/);
    expect(recorder).toMatch(/onBusyChange[\s\S]{0,400}"uploading"/);
  });

  it("AudioRecorderAnswer gỡ cờ bận khi bị tháo khỏi màn hình", () => {
    // Không có dòng này thì đổi phần/đóng bài lúc đang ghi sẽ kẹt cờ bận vĩnh viễn.
    expect(recorder).toMatch(/return\s*\(\)\s*=>\s*onBusyChange\?\.\([^)]*null\)/);
  });

  it("màn làm bài nhận cờ bận từ ô ghi âm", () => {
    expect(workspace).toMatch(/<AudioRecorderAnswer[\s\S]{0,300}onBusyChange=/);
    expect(workspace).toContain("blockingRecorder");
  });

  it("nút Nộp không mở hộp xác nhận khi đang ghi/đang tải lên", () => {
    // Chặn ngay ở nút: chưa kịp mở hộp xác nhận thì đã có cảnh báo.
    expect(workspace).toMatch(/if\s*\(blockingRecorder\)[\s\S]{0,200}return;/);
  });

  it("form chặn submit khi còn bản ghi chưa chốt", () => {
    // Chốt cuối: nút "Nộp bài" trong hộp xác nhận và requestSubmit() đều đi qua đây.
    expect(workspace).toMatch(/blockingRecorder[\s\S]{0,200}preventDefault\(\)/);
  });

  it("hộp xác nhận nói rõ là chưa có bản ghi âm", () => {
    // "Còn 1 câu chưa trả lời" quá mơ hồ với bài Nói — phải nói thẳng.
    expect(workspace).toMatch(/chưa có bản ghi âm/i);
  });
});
