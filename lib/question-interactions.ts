export type PromptSegment = {
  type: "text" | "blank";
  value: string;
};

export type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

const dragDropTypes = new Set(["drag_drop_matching", "inline_gap_fill"]);

export function parseQuestionOptions(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.map((option) => String(option));
    }
  } catch {
    return [];
  }

  return [];
}

export function usesDragDropAnswer(questionType: string, options: string[]) {
  return dragDropTypes.has(questionType) && options.length > 0;
}

// Đọc một map { "<order câu đầu nhóm>": "chuỗi" } từ một field trong metadata.
function parseOrderStringMap(
  metadataJson: string | null | undefined,
  field: string
): Record<number, string> {
  if (!metadataJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadataJson);
    const raw = (parsed as Record<string, unknown>)?.[field];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const result: Record<number, string> = {};
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const order = Number(key);
        if (Number.isInteger(order) && typeof value === "string" && value.trim()) {
          result[order] = value;
        }
      }
      return result;
    }
  } catch {
    return {};
  }

  return {};
}

// Hướng dẫn cho từng NHÓM câu (vd "Câu 14–18: ...") lưu trong
// metadata.groupInstructions = { "<order câu đầu nhóm>": "nội dung hướng dẫn" }.
// Hiển thị thành khung đỏ phía trên nhóm câu khi làm bài.
export function parseGroupInstructions(
  metadataJson: string | null | undefined
): Record<number, string> {
  return parseOrderStringMap(metadataJson, "groupInstructions");
}

// Tiêu đề của từng NHÓM câu (vd "New city developments", "Transport Survey") lưu
// trong metadata.groupTitles = { "<order câu đầu nhóm>": "Tiêu đề" }. Hiển thị
// canh giữa, in đậm phía trên khung hướng dẫn — giống tiêu đề đề gốc.
export function parseGroupTitles(
  metadataJson: string | null | undefined
): Record<number, string> {
  return parseOrderStringMap(metadataJson, "groupTitles");
}

// Giá trị câu trả lời là một file audio (bài Speaking ghi âm) hay không.
// Dùng để hiển thị trình phát audio thay vì text ở trang chấm/kết quả.
export function isAudioUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }
  return (
    value.includes("blob.vercel-storage.com") ||
    /\.(webm|ogg|mp3|m4a|mp4|wav|aac)(\?|#|$)/i.test(value)
  );
}

// Đọc một chuỗi trong metadata JSON của phần (vd metadata.noteBody / tableBody):
// thân bài ghi chú/bảng có [[n]], TÁCH RIÊNG khỏi passage để passage vẫn hiển thị.
export function parseUnitMetaString(
  metadataJson: string | null | undefined,
  key: string
): string | null {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson);
    const value = (parsed as Record<string, unknown>)?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  } catch {
    return null;
  }

  return null;
}

// Lấy danh sách ảnh đề bài từ metadata JSON của phần (metadata.images = [url, ...]).
export function parseUnitImages(metadataJson: string | null | undefined): string[] {
  if (!metadataJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(metadataJson);
    const images = (parsed as { images?: unknown })?.images;
    if (Array.isArray(images)) {
      return images.map((url) => String(url)).filter((url) => url.trim().length > 0);
    }
  } catch {
    return [];
  }

  return [];
}

export function splitPromptIntoSegments(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const placeholderPattern = /\[\[(\d+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: prompt.slice(lastIndex, match.index) });
    }

    segments.push({ type: "blank", value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    segments.push({ type: "text", value: prompt.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: prompt }];
}

// Matches an authored blank: either the `[[n]]` placeholder convention or a run
// of 2+ underscores (how short-answer / sentence-completion prompts are written).
const gapPattern = /\[\[(\d+)\]\]|_{2,}/g;

export function promptHasGap(prompt: string): boolean {
  return /\[\[\d+\]\]|_{2,}/.test(prompt);
}

export function splitPromptIntoGapSegments(prompt: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  gapPattern.lastIndex = 0;

  while ((match = gapPattern.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: prompt.slice(lastIndex, match.index) });
    }

    segments.push({ type: "blank", value: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < prompt.length) {
    segments.push({ type: "text", value: prompt.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: prompt }];
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseMarkdownTable(content: string): MarkdownTable | null {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));

  if (lines.length < 2) {
    return null;
  }

  const headers = parseTableRow(lines[0]);
  const separator = parseTableRow(lines[1]);

  if (headers.length < 2 || !isSeparatorRow(separator)) {
    return null;
  }

  const rows = lines
    .slice(2)
    .map(parseTableRow)
    .filter((row) => row.length === headers.length);

  return rows.length > 0 ? { headers, rows } : null;
}
