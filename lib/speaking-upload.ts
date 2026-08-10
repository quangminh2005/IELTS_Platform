// Logic thuần cho bài nộp Speaking: duyệt file học viên chọn, đặt tên file trên
// Blob, và đọc ngược tên đó ra nguồn gốc bản ghi. Tách khỏi component để test
// được mà không cần trình duyệt.

// Trần dung lượng cho MỘT part Speaking. Mỗi part là một AssignableUnit riêng
// với đúng một câu ghi âm, nên trần này áp cho từng part chứ không phải cả bài.
//
// Căn theo số thật: bản ghi lớn nhất học viên đã nộp là 3,08 MB cho câu Part 2
// nói ~2 phút (~1,5 MB/phút). 30MB phủ hết mọi định dạng thật cho một part 5
// phút, kể cả WAV không nén (~5–10 MB/phút), mà vẫn dưới trần 50MB của
// /api/speaking/upload và vẫn chặn được vụ tải nhầm video.
//
// Chặn ở trình duyệt, KHÔNG gọi server: kho Blob từng bị khoá vì vượt băng
// thông, nên chốt phải nằm ở chỗ rẻ nhất.
export const SPEAKING_MAX_BYTES = 30 * 1024 * 1024;

// Đuôi file -> content type gửi lên. Danh sách này phải nằm trong
// allowedContentTypes của app/api/speaking/upload/route.ts, nếu không server sẽ
// từ chối SAU KHI file đã tải xong.
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  webm: "audio/webm"
};

// Đuôi file dùng khi ĐẶT tên, suy ngược từ content type của bản ghi.
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "video/webm": "webm"
};

export type SpeakingSource = "recorded" | "uploaded";

export type SpeakingFileCheck =
  | { ok: true; contentType: string }
  | { ok: false; message: string };

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Duyệt file âm thanh học viên chọn từ máy trước khi tải lên.
 *
 * Content type LUÔN lấy theo đuôi file, không tin `file.type`: iPhone chọn file
 * từ app Files trả type rỗng, và vài trình duyệt gắn "video/mp4" cho .m4a — cả
 * hai đều bị server từ chối.
 */
export function checkSpeakingFile(file: {
  name: string;
  type: string;
  size: number;
}): SpeakingFileCheck {
  const contentType = CONTENT_TYPE_BY_EXTENSION[extensionOf(file.name)];

  if (!contentType) {
    return {
      ok: false,
      message:
        "Em chỉ tải lên được file âm thanh (m4a, mp3, wav, ogg, webm). File em vừa chọn không phải file âm thanh."
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      message: "File này rỗng (0 byte). Em kiểm tra lại xem bản ghi đã lưu xong chưa nhé."
    };
  }

  if (file.size > SPEAKING_MAX_BYTES) {
    return {
      ok: false,
      message: `File nặng quá (${formatMb(file.size)}, tối đa ${formatMb(
        SPEAKING_MAX_BYTES
      )}) — chắc em xuất ra định dạng WAV không nén. Em thu lại bằng ứng dụng ghi âm sẵn của điện thoại (ra file m4a, nhẹ hơn khoảng 20 lần) rồi tải lên nhé.`
    };
  }

  return { ok: true, contentType };
}

/**
 * Đặt tên file trên Blob. Tiền tố mang luôn nguồn gốc bản ghi, nhờ vậy giáo viên
 * phân biệt được "ghi trực tiếp" với "tải file lên" mà KHÔNG cần thêm cột nào
 * vào database — Answer.value vốn đã là URL Blob.
 */
export function speakingUploadName(
  questionId: string,
  source: SpeakingSource,
  contentType: string
): string {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType.split(";")[0]] ?? "webm";
  const prefix = source === "uploaded" ? "speaking-upload" : "speaking";

  return `${prefix}-${questionId}-${Date.now()}.${extension}`;
}

/**
 * Đọc ngược nguồn gốc bản ghi từ URL Blob.
 *
 * Chỉ xét TÊN FILE trong URL (host của Blob có thể đổi), và phải chịu được hậu
 * tố ngẫu nhiên mà `addRandomSuffix: true` chèn vào trước phần đuôi.
 *
 * Bài nộp trước ngày 10/8/2026 đều mang tiền tố "speaking-" và lúc đó chưa có
 * đường tải file, nên trả "recorded" cho chúng là đúng sự thật.
 */
export function speakingAnswerSource(url: string): SpeakingSource | "unknown" {
  const path = url.split(/[?#]/)[0];
  const fileName = path.slice(path.lastIndexOf("/") + 1);

  if (fileName.startsWith("speaking-upload-")) {
    return "uploaded";
  }

  if (fileName.startsWith("speaking-")) {
    return "recorded";
  }

  return "unknown";
}
