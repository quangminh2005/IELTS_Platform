// Khớp transcript (văn bản chuẩn trong DB) với mốc thời gian từng từ do Whisper
// trả về, để trang kết quả bấm vào câu trong transcript là audio tua tới đúng đoạn.
//
// Toàn bộ hàm ở đây THUẦN LOGIC (không DB, không fetch) — dùng chung cho server
// (đồng bộ + backfill) lẫn client (tra giây bắt đầu của từng câu khi render).

// Một từ của transcript kèm giây bắt đầu trong audio (w đã chuẩn hóa).
export type TimingWord = { w: string; t: number };

// Dữ liệu lưu vào AssignableUnit.transcriptTimingJson.
export type TranscriptTiming = {
  v: 1;
  // Tỷ lệ từ của transcript khớp được trực tiếp với ASR (0..1). Thấp = audio và
  // transcript không cùng nội dung (ví dụ audio gộp cả bài) — backfill dùng để cảnh báo.
  matchRatio: number;
  words: TimingWord[];
};

// Từ do Whisper trả về (verbose_json, timestamp_granularities: word).
export type AsrWord = { word: string; start: number };

export type Token = { norm: string; start: number; end: number };

// Chuẩn hóa một từ để so khớp: thường hóa + bỏ mọi ký tự không phải chữ/số.
export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

// Tách text thành danh sách từ kèm vị trí ký tự. "don't" là một từ; "check-in"
// thành hai từ (Whisper cũng hay tách vậy nên hai bên vẫn khớp nhau).
export function tokenizeWithOffsets(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const norm = normalizeToken(m[0]);
    if (norm) {
      tokens.push({ norm, start: m.index, end: m.index + m[0].length });
    }
  }
  return tokens;
}

// Khớp chuỗi từ transcript với chuỗi từ ASR bằng LCS (so trình tự, giữ thứ tự).
// Từ không khớp trực tiếp (tiêu đề SECTION, tên người nói, (Pause), từ ASR nghe
// sai...) được NỘI SUY thời gian từ hai từ khớp gần nhất hai bên.
export function buildTranscriptTiming(
  transcript: string,
  asrWords: AsrWord[]
): TranscriptTiming {
  const tokens = tokenizeWithOffsets(transcript);
  const asr = asrWords
    .map((w) => ({ norm: normalizeToken(w.word), t: w.start }))
    .filter((w) => w.norm);

  const n = tokens.length;
  const m = asr.length;
  if (n === 0) {
    return { v: 1, matchRatio: 0, words: [] };
  }

  // LCS bảng (n+1) x (m+1). Đề IELTS ~1.500 từ nên bảng ~vài triệu ô — vẫn nhẹ.
  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        tokens[i].norm === asr[j].norm
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
    }
  }

  // Truy vết: thời gian cho từ transcript khớp trực tiếp.
  const times: Array<number | null> = new Array(n).fill(null);
  let matched = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tokens[i].norm === asr[j].norm) {
      times[i] = asr[j].t;
      matched += 1;
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  // Nội suy từ chưa có thời gian: tuyến tính theo chỉ số từ giữa hai mốc gần nhất;
  // trước mốc đầu / sau mốc cuối thì kẹp vào mốc đó.
  let prevIdx = -1;
  for (let k = 0; k < n; k++) {
    if (times[k] !== null) {
      if (prevIdx === -1) {
        for (let g = 0; g < k; g++) times[g] = times[k];
      } else {
        const span = k - prevIdx;
        const t0 = times[prevIdx] as number;
        const t1 = times[k] as number;
        for (let g = prevIdx + 1; g < k; g++) {
          times[g] = t0 + ((t1 - t0) * (g - prevIdx)) / span;
        }
      }
      prevIdx = k;
    }
  }
  if (prevIdx === -1) {
    // Không khớp được từ nào.
    return { v: 1, matchRatio: 0, words: [] };
  }
  for (let g = prevIdx + 1; g < n; g++) times[g] = times[prevIdx];

  return {
    v: 1,
    matchRatio: matched / n,
    words: tokens.map((token, idx) => ({
      w: token.norm,
      t: Math.round((times[idx] as number) * 100) / 100
    }))
  };
}

// Đọc transcriptTimingJson từ DB; sai định dạng -> null (UI giữ hành vi cũ).
export function parseTranscriptTiming(json: string | null | undefined): TranscriptTiming | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as TranscriptTiming;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.words)) {
      return parsed;
    }
  } catch {
    // JSON hỏng -> coi như chưa có timing.
  }
  return null;
}

// Ranh giới câu — cùng ngữ nghĩa tách câu với answer-evidence (sau .!? hoặc xuống dòng).
export type SentenceRange = { start: number; end: number };

export function findSentenceRanges(text: string): SentenceRange[] {
  const ranges: SentenceRange[] = [];
  const re = /(?<=[.!?])\s+|\n+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      ranges.push({ start: last, end: m.index });
    }
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < text.length) {
    ranges.push({ start: last, end: text.length });
  }
  // Bỏ "câu" toàn khoảng trắng.
  return ranges.filter((r) => text.slice(r.start, r.end).trim().length > 0);
}

export type SentenceTime = SentenceRange & { t: number | null };

// Tra giây bắt đầu của từng câu trong văn bản ĐANG HIỂN THỊ (đã điền đáp án vào
// chỗ trống). Hai bên gần như cùng một chuỗi từ nên chỉ cần dò một lượt hai con
// trỏ, cho phép nhìn trước một cửa sổ nhỏ để nhảy qua từ chèn/sửa lệch nhau.
export function buildSentenceTimes(
  displayText: string,
  words: TimingWord[]
): SentenceTime[] {
  const tokens = tokenizeWithOffsets(displayText);
  const tokenTimes: Array<number | null> = new Array(tokens.length).fill(null);

  const LOOKAHEAD = 50;
  let p = 0;
  for (let i = 0; i < tokens.length; i++) {
    const limit = Math.min(words.length, p + LOOKAHEAD);
    for (let j = p; j < limit; j++) {
      if (words[j].w === tokens[i].norm) {
        tokenTimes[i] = words[j].t;
        p = j + 1;
        break;
      }
    }
  }

  return findSentenceRanges(displayText).map((range) => {
    let t: number | null = null;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].start >= range.end) break;
      if (tokens[i].start >= range.start && tokenTimes[i] !== null) {
        t = tokenTimes[i];
        break;
      }
    }
    return { ...range, t };
  });
}

// Nhóm các đoạn (đã cắt theo dẫn chứng) lại theo câu: cắt thêm tại ranh giới câu
// rồi gộp các mảnh liên tiếp cùng câu — mỗi nhóm là một cụm bấm-để-nghe. Ký tự
// nằm giữa hai câu (khoảng trắng/xuống dòng) tính vào câu đứng trước.
export function groupSegmentsBySentence<S extends { text: string }>(
  segments: S[],
  sentences: SentenceTime[]
): Array<{ t: number | null; segments: S[] }> {
  // Điểm bắt đầu của từng câu (điểm cắt bổ sung).
  const starts = sentences.map((s) => s.start);

  // Chỉ số câu chứa một vị trí ký tự: câu cuối cùng có start <= offset.
  const sentenceIndexAt = (offset: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= offset) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  };

  type Piece = { seg: S; sentenceIdx: number };
  const pieces: Piece[] = [];
  let offset = 0;
  for (const seg of segments) {
    let localStart = 0;
    while (localStart < seg.text.length) {
      const absStart = offset + localStart;
      const idx = sentenceIndexAt(absStart);
      // Cắt tại điểm bắt đầu câu kế tiếp (nếu nằm trong đoạn này).
      const nextStart = idx + 1 < starts.length ? starts[idx + 1] : Infinity;
      const localEnd = Math.min(seg.text.length, nextStart - offset);
      pieces.push({
        seg: { ...seg, text: seg.text.slice(localStart, localEnd) },
        sentenceIdx: idx
      });
      localStart = localEnd;
    }
    if (seg.text.length === 0) {
      pieces.push({ seg, sentenceIdx: sentenceIndexAt(offset) });
    }
    offset += seg.text.length;
  }

  const groups: Array<{ t: number | null; segments: S[] }> = [];
  let currentIdx = -1;
  for (const piece of pieces) {
    if (piece.sentenceIdx !== currentIdx) {
      groups.push({ t: sentences[piece.sentenceIdx]?.t ?? null, segments: [] });
      currentIdx = piece.sentenceIdx;
    }
    groups[groups.length - 1].segments.push(piece.seg);
  }
  return groups;
}

// Giây bắt đầu của câu dẫn chứng theo số câu hỏi (order) — cho nút ▶ trên thẻ câu.
// Lấy nhóm ĐẦU TIÊN có đoạn thuộc câu dẫn chứng của order đó.
export function evidenceOrderTimes(
  groups: Array<{ t: number | null; segments: Array<{ sentenceOrders: number[] }> }>
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const group of groups) {
    if (group.t === null) continue;
    for (const seg of group.segments) {
      for (const order of seg.sentenceOrders) {
        if (!(order in result)) {
          result[order] = group.t;
        }
      }
    }
  }
  return result;
}

// Lùi lại một nhịp trước khi phát để không cắt mất đầu câu.
export const SEEK_LEAD_SECONDS = 1;

export function seekTime(t: number): number {
  return Math.max(0, t - SEEK_LEAD_SECONDS);
}
