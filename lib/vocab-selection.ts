/*
  Hàm thuần cho nút "➕ Sổ từ" ở trang Kết quả: kiểm vùng học viên bôi đen, cắt
  câu chứa từ làm câu ví dụ, đọc JSON từ điển. KHÔNG dùng regex lookbehind —
  Safari iOS < 16.4 báo SyntaxError ngay lúc nạp file (xem CLAUDE.md).
*/

const MAX_SELECTION_LENGTH = 40;
const MAX_SENTENCE_LENGTH = 400;

// 1–3 từ tiếng Anh; cho phép gạch nối và dấu nháy (well-being, children's).
const ADDABLE = /^[A-Za-z][A-Za-z'’-]*(?: [A-Za-z][A-Za-z'’-]*){0,2}$/;

// Bỏ dấu câu/ngoặc dính ở hai đầu và gộp khoảng trắng.
export function cleanSelection(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^A-Za-z]+/, "")
    .replace(/[^A-Za-z]+$/, "");
}

export function isAddableSelection(text: string): boolean {
  const value = cleanSelection(text);

  return value.length > 0 && value.length <= MAX_SELECTION_LENGTH && ADDABLE.test(value);
}

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

// Dấu . ! ? chỉ kết thúc câu khi theo sau là khoảng trắng hoặc hết chuỗi —
// để "2.5" hay "e.g." giữa câu không cắt nhầm.
function endsSentence(text: string, index: number): boolean {
  const char = text[index];

  return (char === "." || char === "!" || char === "?") && isSpace(text[index + 1]);
}

export function sentenceAround(text: string, start: number, end: number): string {
  let from = start;

  while (from > 0) {
    const previous = from - 1;

    if (text[previous] === "\n" || endsSentence(text, previous)) {
      break;
    }

    from = previous;
  }

  let to = Math.max(end, start);

  while (to < text.length) {
    if (text[to] === "\n") {
      break;
    }

    if (endsSentence(text, to)) {
      to += 1;
      break;
    }

    to += 1;
  }

  const sentence = text.slice(from, to).replace(/\s+/g, " ").trim();

  if (sentence.length <= MAX_SENTENCE_LENGTH) {
    return sentence;
  }

  // Đoạn không có dấu câu (bảng, ghi chú) → lấy một khúc quanh từ cho gọn.
  const windowStart = Math.max(from, start - 150);

  return text.slice(windowStart, Math.min(to, end + 150)).replace(/\s+/g, " ").trim();
}

export type DictionaryEntry = {
  phonetic: string | null;
  partOfSpeech: string | null;
  definitionEn: string | null;
};

type RawEntry = {
  phonetic?: unknown;
  phonetics?: Array<{ text?: unknown }>;
  meanings?: Array<{ partOfSpeech?: unknown; definitions?: Array<{ definition?: unknown }> }>;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

// Đọc kết quả của api.dictionaryapi.dev (mảng entry; không thấy từ thì trả object
// { title: "No Definitions Found" }).
export function parseDictionaryEntry(json: unknown): DictionaryEntry | null {
  if (!Array.isArray(json) || json.length === 0) {
    return null;
  }

  const entry = json[0] as RawEntry;
  const phonetic =
    text(entry.phonetic) ??
    (entry.phonetics ?? []).map((item) => text(item?.text)).find((value) => value !== null) ??
    null;
  const meaning = (entry.meanings ?? [])[0];
  const partOfSpeech = text(meaning?.partOfSpeech);
  const definitionEn = text(meaning?.definitions?.[0]?.definition);

  if (!phonetic && !partOfSpeech && !definitionEn) {
    return null;
  }

  return { phonetic, partOfSpeech, definitionEn };
}

type WiktionarySense = {
  partOfSpeech?: unknown;
  definitions?: Array<{ definition?: unknown }>;
};

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " "
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

// Đọc kết quả Wiktionary REST (/page/definition/{từ}) — nguồn dự phòng khi
// api.dictionaryapi.dev không vào được (từ máy ở VN có lúc bị chặn hẳn). Không
// có phiên âm; nghĩa là HTML nên phải bóc thẻ.
export function parseWiktionaryEntry(json: unknown): DictionaryEntry | null {
  const senses = (json as { en?: WiktionarySense[] } | null)?.en;

  if (!Array.isArray(senses)) {
    return null;
  }

  for (const sense of senses) {
    for (const item of sense.definitions ?? []) {
      const definition = typeof item?.definition === "string" ? stripHtml(item.definition) : "";

      if (definition.length > 0) {
        const partOfSpeech = text(sense.partOfSpeech);

        return {
          phonetic: null,
          partOfSpeech: partOfSpeech ? partOfSpeech.toLowerCase() : null,
          definitionEn: definition
        };
      }
    }
  }

  return null;
}

// Gộp hai nguồn: ưu tiên dictionaryapi (có phiên âm), thiếu gì lấy Wiktionary bù.
export function mergeDictionaryEntries(
  primary: DictionaryEntry | null,
  fallback: DictionaryEntry | null
): DictionaryEntry | null {
  if (!primary && !fallback) {
    return null;
  }

  return {
    phonetic: primary?.phonetic ?? fallback?.phonetic ?? null,
    partOfSpeech: primary?.partOfSpeech ?? fallback?.partOfSpeech ?? null,
    definitionEn: primary?.definitionEn ?? fallback?.definitionEn ?? null
  };
}

// Từ bôi đen ở đầu câu thường viết hoa ("Library") — đưa về chữ thường cho Sổ từ.
// Chỉ hạ khi mỗi từ chỉ hoa chữ cái đầu; giữ nguyên viết tắt kiểu "UK", "NASA".
export function toLearnerForm(text: string): string {
  const value = cleanSelection(text);
  const onlyInitialCaps = value.split(" ").every((part) => /^[A-Z]?[a-z'’-]*$/.test(part));

  return onlyInitialCaps ? value.toLowerCase() : value;
}
