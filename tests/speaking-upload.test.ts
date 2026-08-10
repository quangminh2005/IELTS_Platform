import { describe, expect, it } from "vitest";
import {
  SPEAKING_MAX_BYTES,
  checkSpeakingFile,
  speakingAnswerSource,
  speakingUploadName
} from "@/lib/speaking-upload";

const MB = 1024 * 1024;

describe("checkSpeakingFile", () => {
  it("nhận file m4a của iPhone dù trình duyệt không cho biết MIME type", () => {
    // iPhone chọn file từ app Files trả file.type là chuỗi rỗng. Tin file.type là
    // gửi lên content-type rỗng -> server từ chối SAU KHI đã tải xong.
    const result = checkSpeakingFile({ name: "Ghi âm 3.m4a", type: "", size: 2 * MB });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contentType).toBe("audio/mp4");
  });

  it("nhận đuôi file viết hoa", () => {
    const result = checkSpeakingFile({ name: "PART2.MP3", type: "", size: MB });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contentType).toBe("audio/mpeg");
  });

  it("đuôi file quyết định content type, không phải file.type", () => {
    // Vài trình duyệt gắn "video/mp4" cho .m4a — server chỉ nhận audio/*.
    const result = checkSpeakingFile({ name: "a.m4a", type: "video/mp4", size: MB });

    expect(result.ok).toBe(true);
    expect(result.ok && result.contentType).toBe("audio/mp4");
  });

  it.each(["wav", "ogg", "webm", "aac"])("nhận đuôi .%s", (ext) => {
    expect(checkSpeakingFile({ name: `bai.${ext}`, type: "", size: MB }).ok).toBe(true);
  });

  it.each(["bai.pdf", "bai.docx", "anh.png", "khong-co-duoi"])(
    "từ chối %s",
    (name) => {
      const result = checkSpeakingFile({ name, type: "", size: MB });

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).toMatch(/file âm thanh/i);
    }
  );

  it("từ chối file vượt trần và chỉ luôn đường thoát", () => {
    const result = checkSpeakingFile({
      name: "bai.wav",
      type: "audio/wav",
      size: SPEAKING_MAX_BYTES + 1
    });

    expect(result.ok).toBe(false);
    // Báo "quá nặng" suông thì học viên bó tay — phải mách cách thu ra file nhẹ.
    expect(result.ok === false && result.message).toMatch(/m4a/i);
    expect(result.ok === false && result.message).toMatch(/30MB|31|nặng/i);
  });

  it("trần đúng 30MB", () => {
    expect(SPEAKING_MAX_BYTES).toBe(30 * MB);
    expect(checkSpeakingFile({ name: "a.wav", type: "", size: SPEAKING_MAX_BYTES }).ok).toBe(
      true
    );
  });

  it("từ chối file rỗng", () => {
    expect(checkSpeakingFile({ name: "a.m4a", type: "", size: 0 }).ok).toBe(false);
  });
});

describe("speakingUploadName", () => {
  it("bản ghi trực tiếp giữ nếp tên cũ", () => {
    const name = speakingUploadName("q123", "recorded", "audio/webm");

    expect(name).toMatch(/^speaking-q123-\d+\.webm$/);
  });

  it("file tải lên mang tiền tố riêng để nhận ra nguồn gốc", () => {
    const name = speakingUploadName("q123", "uploaded", "audio/mp4");

    expect(name).toMatch(/^speaking-upload-q123-\d+\.m4a$/);
  });
});

describe("speakingAnswerSource", () => {
  const host = "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com";

  it("đọc ra bản ghi trực tiếp", () => {
    expect(speakingAnswerSource(`${host}/speaking-q123-1786267342171.webm`)).toBe("recorded");
  });

  it("đọc ra file học viên tải lên", () => {
    expect(speakingAnswerSource(`${host}/speaking-upload-q123-1786267342171.m4a`)).toBe(
      "uploaded"
    );
  });

  it("chịu được hậu tố ngẫu nhiên của addRandomSuffix", () => {
    // Blob chèn hậu tố vào TRƯỚC phần đuôi: ...-1786267342171-Ia1i7JQ95g0FiOO.mp4
    expect(
      speakingAnswerSource(`${host}/speaking-upload-q1-1786267342171-Ia1i7JQ95g0FiOO.m4a`)
    ).toBe("uploaded");
    expect(
      speakingAnswerSource(`${host}/speaking-q1-1786267342171-Ia1i7JQ95g0FiOO.mp4`)
    ).toBe("recorded");
  });

  it("bài nộp trước ngày có tính năng này đều là ghi trực tiếp", () => {
    // Đúng sự thật chứ không phải phỏng đoán: lúc đó chưa có đường tải file.
    expect(
      speakingAnswerSource(
        `${host}/speaking-cmsklz4lr0003qh8z80dq8vql-1786267342171-Ia1i7JQ95g0FiOO`
      )
    ).toBe("recorded");
  });

  it("URL lạ thì không đoán bừa", () => {
    expect(speakingAnswerSource(`${host}/audio-part1.mp3`)).toBe("unknown");
    expect(speakingAnswerSource("")).toBe("unknown");
    expect(speakingAnswerSource("khong-phai-url")).toBe("unknown");
  });
});
