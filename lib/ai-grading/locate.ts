// Tìm đoạn trích lỗi AI đưa ra trong bài làm. Model hay đổi khoảng trắng, nháy cong
// thành nháy thẳng hoặc hoa/thường, nên ngoài khớp nguyên văn còn so trên bản chuẩn
// hoá kèm bảng ánh xạ vị trí về chuỗi gốc.

export type QuoteSpan = { start: number; end: number };

function normalizeChar(ch: string): string {
  if (ch === "’" || ch === "‘") return "'";
  if (ch === "“" || ch === "”") return '"';
  return ch.toLowerCase();
}

function normalizeWithMap(text: string): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  let prevSpace = false;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (/\s/.test(ch)) {
      if (prevSpace || normalized.length === 0) continue;
      normalized += " ";
      map.push(index);
      prevSpace = true;
      continue;
    }
    normalized += normalizeChar(ch);
    map.push(index);
    prevSpace = false;
  }

  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    map.pop();
  }

  return { normalized, map };
}

export function locateQuote(text: string, quote: string, from = 0): QuoteSpan | null {
  const needle = quote.trim();
  if (!needle) return null;

  const exact = text.indexOf(needle, from);
  if (exact >= 0) return { start: exact, end: exact + needle.length };

  const source = normalizeWithMap(text);
  const target = normalizeWithMap(needle).normalized;
  if (!target) return null;

  const startAt = source.map.findIndex((original) => original >= from);
  if (startAt < 0) return null;

  const at = source.normalized.indexOf(target, startAt);
  if (at < 0) return null;

  return { start: source.map[at], end: source.map[at + target.length - 1] + 1 };
}

// Định vị cả danh sách: đoạn trích trùng nhau lấy lần xuất hiện kế tiếp.
export function locateQuotes(text: string, quotes: string[]): (QuoteSpan | null)[] {
  const used: QuoteSpan[] = [];

  return quotes.map((quote) => {
    let from = 0;
    for (let tries = 0; tries < 20; tries += 1) {
      const span = locateQuote(text, quote, from);
      if (!span) return null;
      const clash = used.find((other) => span.start < other.end && other.start < span.end);
      if (!clash) {
        used.push(span);
        return span;
      }
      from = clash.end;
    }
    return null;
  });
}

// Cắt chữ thành các đoạn để tô màu. index = vị trí lỗi trong danh sách, null = chữ thường.
// Span đè lên span trước bị bỏ qua (chỉ tô một lần).
export function buildHighlightSegments(
  text: string,
  spans: (QuoteSpan | null)[]
): { text: string; index: number | null }[] {
  const ordered = spans
    .map((span, index) => (span ? { ...span, index } : null))
    .filter((item): item is QuoteSpan & { index: number } => item !== null)
    .sort((a, b) => a.start - b.start);

  const segments: { text: string; index: number | null }[] = [];
  let cursor = 0;

  for (const span of ordered) {
    if (span.start < cursor) continue;
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start), index: null });
    segments.push({ text: text.slice(span.start, span.end), index: span.index });
    cursor = span.end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), index: null });
  return segments;
}
