import { matchesSearch } from "@/lib/assignment-wizard";

// Một dòng trong Sổ từ của học viên: từ đã phát + kết quả ôn của riêng em đó.
export type VocabWordEntry = {
  id: string;
  display: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  meaningVi: string;
  definitionEn: string | null;
  exampleEn: string;
  sourceLabel: string | null;
  // Ngày phát (yyyy-mm-dd theo giờ VN). Từ phát nhiều lần lấy lần đầu.
  releasedOn: string;
  correctCount: number;
  wrongCount: number;
};

export type VocabDateGroup = {
  date: string;
  label: string;
  words: VocabWordEntry[];
};

// Tìm theo từ tiếng Anh hoặc nghĩa Việt; gõ không dấu vẫn ra nhờ matchesSearch.
export function filterVocabWords(words: VocabWordEntry[], query: string): VocabWordEntry[] {
  const needle = query.trim();

  if (!needle) {
    return words;
  }

  return words.filter(
    (word) => matchesSearch(word.display, needle) || matchesSearch(word.meaningVi, needle)
  );
}

// "2026-09-03" → "3/9/2026" — không qua Intl để test không phụ thuộc locale máy.
export function formatVietnamDate(key: string): string {
  const [year, month, day] = key.split("-").map(Number);

  return `${day}/${month}/${year}`;
}

export function groupVocabWordsByDate(words: VocabWordEntry[]): VocabDateGroup[] {
  const byDate = new Map<string, VocabWordEntry[]>();

  for (const word of words) {
    const bucket = byDate.get(word.releasedOn) ?? [];
    bucket.push(word);
    byDate.set(word.releasedOn, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, label: formatVietnamDate(date), words: items }));
}
