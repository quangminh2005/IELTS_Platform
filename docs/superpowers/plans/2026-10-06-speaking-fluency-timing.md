# Đo độ trôi chảy Speaking từ mốc thời gian — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI chấm Fluency Speaking dựa trên tốc độ nói và chỗ ngừng đo từ audio thật (mốc từng từ của Groq), thầy thấy số đo ở trang chấm.

**Architecture:** Groq trả `verbose_json` + mốc từng từ → lưu `Answer.speechTimingJson`. Hàm thuần `lib/speech-fluency.ts` tính số đo và chèn `(pause Ns)` vào bản phiên âm; `input.ts`/`prompt.ts` đưa vào prompt; trang chấm của thầy hiện dòng số đo.

**Tech Stack:** Next.js 14 server actions, Prisma/Postgres, Groq Whisper API, vitest.

Spec: `docs/superpowers/specs/2026-10-06-speaking-fluency-timing-design.md`

## Global Constraints

- Chữ hiển thị & comment tiếng Việt có dấu; prompt gửi model bằng tiếng Anh.
- Cột mới phải có trong `scripts/ensure-db.mjs` (`ADD COLUMN IF NOT EXISTS`), nếu không prod sập.
- `Answer.transcript` giữ chữ sạch (không chèn dấu ngừng). Học viên KHÔNG thấy số đo ở bất kỳ trang nào.
- Ngưỡng ngừng: ≥ 1,0 s là một lần ngừng; ≥ 2,0 s là ngừng dài.
- System prompt chỉ phụ thuộc (kỹ năng, loại task) — không chèn gì theo bài (giữ cache tiền tố).

---

### Task 1: `lib/speech-fluency.ts` — số đo + chèn dấu ngừng (hàm thuần)

**Files:**
- Create: `lib/speech-fluency.ts`
- Test: `tests/speech-fluency.test.ts`

**Interfaces:**
- Produces: `TimedWord`, `FluencyStats`, `PAUSE_MIN_SECONDS`, `LONG_PAUSE_SECONDS`, `serializeSpeechTiming(words)`, `parseSpeechTiming(json)`, `computeFluencyStats(words)`, `combineFluencyStats(list)`, `annotatePauses(words)`, `stripPauseMarkers(text)`, `formatFluencyLine(stats)`, `formatFluencyForModel(stats)`.

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from "vitest";
import {
  annotatePauses,
  combineFluencyStats,
  computeFluencyStats,
  formatFluencyForModel,
  formatFluencyLine,
  parseSpeechTiming,
  serializeSpeechTiming,
  stripPauseMarkers,
  type TimedWord
} from "@/lib/speech-fluency";

// Lấy từ phản hồi Groq thật (đoạn TTS chèn ngừng 3 s và 2 s), rút gọn.
const words: TimedWord[] = [
  { w: "Well,", s: 0.12, e: 0.62 },
  { w: "I", s: 0.62, e: 0.98 },
  { w: "think", s: 0.98, e: 1.2 },
  { w: "it", s: 1.2, e: 1.42 },
  { w: "is", s: 1.42, e: 1.78 },
  { w: "nice.", s: 1.78, e: 3.5 },
  { w: "Because", s: 7.24, e: 7.6 },
  { w: "people", s: 7.6, e: 8.0 },
  { w: "are", s: 8.0, e: 8.16 },
  { w: "friendly.", s: 10.22, e: 10.8 }
];

describe("computeFluencyStats", () => {
  it("tính tốc độ từ từ đầu đến từ cuối và tách ngừng giữa cụm / giữa câu", () => {
    const stats = computeFluencyStats(words)!;
    expect(stats.wordCount).toBe(10);
    expect(stats.speakingSeconds).toBeCloseTo(10.68, 2);
    expect(stats.wordsPerMinute).toBe(56);
    expect(stats.pausesOver1s).toBe(2);
    expect(stats.pausesOver2s).toBe(2);
    // "nice." có dấu chấm → ngừng giữa câu; "are" không dấu → giữa cụm từ.
    expect(stats.midPhrasePausesOver1s).toBe(1);
    expect(stats.longestPause).toBeCloseTo(3.74, 2);
  });

  it("câu quá ngắn thì không kết luận tốc độ", () => {
    const stats = computeFluencyStats(words.slice(0, 3))!;
    expect(stats.wordsPerMinute).toBeNull();
  });

  it("không có từ nào → null", () => {
    expect(computeFluencyStats([])).toBeNull();
  });
});

describe("combineFluencyStats", () => {
  it("cộng dồn và tính lại tốc độ trên tổng", () => {
    const a = computeFluencyStats(words)!;
    const total = combineFluencyStats([a, a])!;
    expect(total.wordCount).toBe(20);
    expect(total.pausesOver1s).toBe(4);
    expect(total.midPhrasePausesOver1s).toBe(2);
    expect(total.wordsPerMinute).toBe(56);
    expect(total.longestPause).toBeCloseTo(3.74, 2);
  });

  it("danh sách rỗng → null", () => {
    expect(combineFluencyStats([])).toBeNull();
  });
});

describe("annotatePauses / stripPauseMarkers", () => {
  it("chèn dấu ngừng ≥ 1 giây vào đúng chỗ", () => {
    expect(annotatePauses(words)).toBe(
      "Well, I think it is nice. (pause 3.7s) Because people are (pause 2.1s) friendly."
    );
  });

  it("bỏ dấu ngừng khỏi đoạn trích model trả về", () => {
    expect(stripPauseMarkers("people are (pause 2.1s) friendly")).toBe("people are friendly");
    expect(stripPauseMarkers("(Pause 1s) I goes")).toBe("I goes");
  });
});

describe("lưu / đọc mốc thời gian", () => {
  it("đọc lại đúng thứ đã lưu", () => {
    expect(parseSpeechTiming(serializeSpeechTiming(words))).toEqual(words);
  });

  it("JSON hỏng, sai phiên bản hoặc rỗng → null, không ném lỗi", () => {
    expect(parseSpeechTiming(null)).toBeNull();
    expect(parseSpeechTiming("{oops")).toBeNull();
    expect(parseSpeechTiming(JSON.stringify({ v: 2, words }))).toBeNull();
    expect(parseSpeechTiming(JSON.stringify({ v: 1, words: [] }))).toBeNull();
  });
});

describe("định dạng số đo", () => {
  const stats = computeFluencyStats(words)!;

  it("dòng tiếng Việt cho thầy (dấu phẩy thập phân)", () => {
    expect(formatFluencyLine(stats)).toBe(
      "Tốc độ ~56 từ/phút · ngừng ≥1 giây: 2 lần (1 giữa cụm từ) · ≥2 giây: 2 lần · lâu nhất 3,7 giây"
    );
  });

  it("dòng tiếng Anh cho model", () => {
    expect(formatFluencyForModel(stats)).toBe(
      "56 words/min · pauses ≥1s: 2 (1 mid-phrase) · ≥2s: 2 · longest 3.7s"
    );
  });

  it("câu quá ngắn", () => {
    const short = computeFluencyStats(words.slice(0, 3))!;
    expect(formatFluencyLine(short)).toContain("quá ngắn để đo tốc độ");
    expect(formatFluencyForModel(short)).toContain("too short to measure");
  });
});
```

- [ ] **Step 2: Chạy test, phải FAIL** — `npx vitest run tests/speech-fluency.test.ts` → "Failed to resolve import @/lib/speech-fluency".

- [ ] **Step 3: Viết `lib/speech-fluency.ts`**

```ts
// Số đo độ trôi chảy Speaking từ mốc thời gian từng từ của Groq (spec
// docs/superpowers/specs/2026-10-06-speaking-fluency-timing-design.md).
// Bản phiên âm bỏ hết "um, uh" và khoảng lặng nên đọc trôi chảy hơn thực tế; khoảng
// hở giữa hai từ liền nhau thì vẫn còn → đo được tốc độ nói và chỗ ngừng thật.

export type TimedWord = { w: string; s: number; e: number };

export type FluencyStats = {
  wordCount: number;
  // Từ đầu từ đầu tiên đến hết từ cuối (bỏ lặng trước/sau khi nói).
  speakingSeconds: number;
  // null = câu quá ngắn để kết luận.
  wordsPerMinute: number | null;
  pausesOver1s: number;
  pausesOver2s: number;
  // Ngừng khi từ đứng trước chưa hết câu/vế (không có dấu câu) = đang tìm từ.
  midPhrasePausesOver1s: number;
  longestPause: number;
};

export const PAUSE_MIN_SECONDS = 1.0;
export const LONG_PAUSE_SECONDS = 2.0;
const MIN_SECONDS_FOR_RATE = 3;
const MIN_WORDS_FOR_RATE = 5;
const TIMING_VERSION = 1;

function endsClause(word: string): boolean {
  return /[.,?!;:…]["'”’)\]]?$/.test(word);
}

function rate(wordCount: number, seconds: number): number | null {
  if (wordCount < MIN_WORDS_FOR_RATE || seconds < MIN_SECONDS_FOR_RATE) return null;
  return Math.round((wordCount / seconds) * 60);
}

export function serializeSpeechTiming(words: TimedWord[]): string {
  return JSON.stringify({ v: TIMING_VERSION, words });
}

export function parseSpeechTiming(json: string | null | undefined): TimedWord[] | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as { v?: unknown; words?: unknown };
    if (data?.v !== TIMING_VERSION || !Array.isArray(data.words)) return null;
    const words = data.words.filter(
      (item): item is TimedWord =>
        typeof item?.w === "string" && Number.isFinite(item?.s) && Number.isFinite(item?.e)
    );
    return words.length > 0 ? words : null;
  } catch {
    return null;
  }
}

export function computeFluencyStats(words: TimedWord[]): FluencyStats | null {
  if (words.length === 0) return null;

  let pausesOver1s = 0;
  let pausesOver2s = 0;
  let midPhrasePausesOver1s = 0;
  let longestPause = 0;

  for (let index = 1; index < words.length; index += 1) {
    const gap = words[index].s - words[index - 1].e;
    if (gap > longestPause) longestPause = gap;
    if (gap < PAUSE_MIN_SECONDS) continue;
    pausesOver1s += 1;
    if (gap >= LONG_PAUSE_SECONDS) pausesOver2s += 1;
    if (!endsClause(words[index - 1].w)) midPhrasePausesOver1s += 1;
  }

  const speakingSeconds = Math.max(0, words[words.length - 1].e - words[0].s);

  return {
    wordCount: words.length,
    speakingSeconds,
    wordsPerMinute: rate(words.length, speakingSeconds),
    pausesOver1s,
    pausesOver2s,
    midPhrasePausesOver1s,
    longestPause
  };
}

export function combineFluencyStats(list: FluencyStats[]): FluencyStats | null {
  if (list.length === 0) return null;
  const wordCount = list.reduce((sum, item) => sum + item.wordCount, 0);
  const speakingSeconds = list.reduce((sum, item) => sum + item.speakingSeconds, 0);
  return {
    wordCount,
    speakingSeconds,
    wordsPerMinute: rate(wordCount, speakingSeconds),
    pausesOver1s: list.reduce((sum, item) => sum + item.pausesOver1s, 0),
    pausesOver2s: list.reduce((sum, item) => sum + item.pausesOver2s, 0),
    midPhrasePausesOver1s: list.reduce((sum, item) => sum + item.midPhrasePausesOver1s, 0),
    longestPause: Math.max(...list.map((item) => item.longestPause))
  };
}

// Bản phiên âm gửi model: chèn "(pause 2.1s)" ở mỗi khoảng lặng ≥ 1 giây.
export function annotatePauses(words: TimedWord[]): string {
  const parts: string[] = [];
  words.forEach((word, index) => {
    if (index > 0) {
      const gap = word.s - words[index - 1].e;
      if (gap >= PAUSE_MIN_SECONDS) parts.push(`(pause ${gap.toFixed(1)}s)`);
    }
    parts.push(word.w);
  });
  return parts.join(" ");
}

// Model lỡ chép dấu ngừng vào đoạn trích lỗi → bỏ đi để đối chiếu với bản phiên âm sạch.
export function stripPauseMarkers(text: string): string {
  return text
    .replace(/\(pause \d+(?:\.\d+)?s\)/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function seconds(value: number): string {
  return value.toFixed(1);
}

// Dòng cho thầy ở trang chấm (không hiện cho học viên).
export function formatFluencyLine(stats: FluencyStats): string {
  const speed =
    stats.wordsPerMinute === null ? "Câu quá ngắn để đo tốc độ" : `Tốc độ ~${stats.wordsPerMinute} từ/phút`;
  return [
    speed,
    `ngừng ≥1 giây: ${stats.pausesOver1s} lần (${stats.midPhrasePausesOver1s} giữa cụm từ)`,
    `≥2 giây: ${stats.pausesOver2s} lần`,
    `lâu nhất ${seconds(stats.longestPause).replace(".", ",")} giây`
  ].join(" · ");
}

// Dòng "Timing" trong prompt gửi model.
export function formatFluencyForModel(stats: FluencyStats): string {
  const speed =
    stats.wordsPerMinute === null ? "speaking rate: too short to measure" : `${stats.wordsPerMinute} words/min`;
  return [
    speed,
    `pauses ≥1s: ${stats.pausesOver1s} (${stats.midPhrasePausesOver1s} mid-phrase)`,
    `≥2s: ${stats.pausesOver2s}`,
    `longest ${seconds(stats.longestPause)}s`
  ].join(" · ");
}
```

- [ ] **Step 4: Chạy test, phải PASS** — `npx vitest run tests/speech-fluency.test.ts`. (wpm: 10 từ / 10,68 s × 60 = 56,2 → 56; khoảng hở: 7,24−3,5 = 3,74; 10,22−8,16 = 2,06.)

- [ ] **Step 5: Commit** — `git add lib/speech-fluency.ts tests/speech-fluency.test.ts && git commit -m "feat(ai-cham): tinh toc do noi + cho ngung tu moc thoi gian tung tu"`

---

### Task 2: Groq trả mốc từng từ + lưu `Answer.speechTimingJson`

**Files:**
- Modify: `lib/groq-transcribe.ts` (kiểu kết quả, gọi `verbose_json`, hàm thuần `parseGroqVerbose`)
- Modify: `prisma/schema.prisma` (model `Answer`), `scripts/ensure-db.mjs`
- Modify: `lib/actions/transcribe.ts`, `components/transcribe-button.tsx`
- Modify: `lib/ai-grading/input.ts` (`ANSWER_ROW_SELECT`, `AnswerRow`), `lib/ai-grading/grade-attempt.ts` (`ensureSpeakingTranscripts`)
- Test: `tests/groq-transcribe.test.ts`

**Interfaces:**
- Consumes: `TimedWord`, `serializeSpeechTiming`, `parseSpeechTiming`, `computeFluencyStats`, `formatFluencyLine`, `FluencyStats` (Task 1).
- Produces: `parseGroqVerbose(body: unknown): { transcript: string; words: TimedWord[] }`; `TranscribeAudioResult` ok-nhánh có `words: TimedWord[]`; `AnswerRow.speechTimingJson?: string | null`; `transcribeAnswer` trả `{ ok: true; transcript; fluency: FluencyStats | null }`.

- [ ] **Step 1: Test `parseGroqVerbose`** (thêm vào `tests/groq-transcribe.test.ts`, sửa import thêm `parseGroqVerbose`)

```ts
describe("đọc phản hồi verbose_json của Groq", () => {
  it("lấy chữ + mốc từng từ, làm tròn 2 chữ số", () => {
    const result = parseGroqVerbose({
      text: "  Well, I think. ",
      words: [
        { word: "Well,", start: 0.12, end: 0.6234 },
        { word: " I", start: 0.62, end: 0.98 },
        { word: "", start: 1, end: 1.1 },
        { word: "think.", start: "x", end: 1.2 }
      ]
    });
    expect(result.transcript).toBe("Well, I think.");
    expect(result.words).toEqual([
      { w: "Well,", s: 0.12, e: 0.62 },
      { w: "I", s: 0.62, e: 0.98 }
    ]);
  });

  it("không có words → mảng rỗng, không ném lỗi", () => {
    expect(parseGroqVerbose({ text: "Hi" })).toEqual({ transcript: "Hi", words: [] });
    expect(parseGroqVerbose(null)).toEqual({ transcript: "", words: [] });
  });
});
```

- [ ] **Step 2: Chạy** `npx vitest run tests/groq-transcribe.test.ts` → FAIL (`parseGroqVerbose` không tồn tại).

- [ ] **Step 3: Sửa `lib/groq-transcribe.ts`**

Thêm import `import type { TimedWord } from "@/lib/speech-fluency";`, đổi kiểu:

```ts
export type TranscribeAudioResult =
  | { ok: true; transcript: string; words: TimedWord[] }
  | { ok: false; error: string; reason: "empty" | "rate_limit" | "other" };
```

Thêm hàm thuần (đặt trên `transcribeAudioUrl`):

```ts
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Phản hồi verbose_json: "text" là bản phiên âm, "words" là mốc từng từ (giây). Mốc
// theo đoạn (segments) KHÔNG dùng được: thử 6/10/2026 nó nuốt mất chỗ ngừng 2 giây
// giữa câu. Dòng từ hỏng thì bỏ qua, không làm hỏng cả bản phiên âm.
export function parseGroqVerbose(body: unknown): { transcript: string; words: TimedWord[] } {
  const data = (body ?? {}) as { text?: unknown; words?: unknown };
  const transcript = typeof data.text === "string" ? data.text.trim() : "";
  const words: TimedWord[] = [];
  if (Array.isArray(data.words)) {
    for (const item of data.words as { word?: unknown; start?: unknown; end?: unknown }[]) {
      const w = typeof item?.word === "string" ? item.word.trim() : "";
      const s = Number(item?.start);
      const e = Number(item?.end);
      if (!w || typeof item?.start !== "number" || typeof item?.end !== "number") continue;
      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
      words.push({ w, s: round2(s), e: round2(e) });
    }
  }
  return { transcript, words };
}
```

Trong `transcribeAudioUrl`, thay `form.append("response_format", "text");` bằng:

```ts
  // verbose_json + mốc từng từ để đo tốc độ nói/chỗ ngừng (lib/speech-fluency.ts).
  // Hạn mức Groq tính theo giây âm thanh nên không tốn thêm.
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
```

và thay khối đọc kết quả:

```ts
  let parsed: { transcript: string; words: TimedWord[] };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    if (!res.ok) {
      return { ok: false, ...groqErrorMessage(res.status, await res.text()) };
    }

    parsed = parseGroqVerbose(await res.json());
  } catch (error) {
    return { ok: false, error: `Lỗi gọi Groq: ${(error as Error).message}`, reason: "other" };
  }

  if (!parsed.transcript) {
    return { ok: false, error: "Không nhận được nội dung phiên âm (bản ghi có thể trống).", reason: "empty" };
  }

  return { ok: true, transcript: parsed.transcript, words: parsed.words };
```

(Bỏ biến `let transcript = "";` cũ.)

- [ ] **Step 4: Chạy** `npx vitest run tests/groq-transcribe.test.ts` → PASS.

- [ ] **Step 5: Cột DB** — `prisma/schema.prisma`, model `Answer`, ngay dưới `transcript String?`:

```prisma
  // Mốc thời gian từng từ của bản phiên âm Speaking (Groq), JSON {v,words} — xem
  // lib/speech-fluency.ts. Dùng đo tốc độ nói/chỗ ngừng cho AI chấm và cho thầy.
  speechTimingJson      String?
```

`scripts/ensure-db.mjs`, ngay dưới dòng `"transcript" TEXT`:

```js
  // Mốc thời gian từng từ của bản phiên âm Speaking (đo độ trôi chảy, 6/10/2026)
  'ALTER TABLE "Answer" ADD COLUMN IF NOT EXISTS "speechTimingJson" TEXT;',
```

Chạy `npx prisma generate` rồi `node scripts/ensure-db.mjs` (DB local `ielts-test`).

- [ ] **Step 6: `lib/actions/transcribe.ts`** — lưu mốc + trả số đo:

```ts
import { computeFluencyStats, serializeSpeechTiming, type FluencyStats } from "@/lib/speech-fluency";

type TranscribeResult =
  | { ok: true; transcript: string; fluency: FluencyStats | null }
  | { ok: false; error: string };
```

Trong `prisma.answer.update`: `data: { transcript: result.transcript, speechTimingJson: result.words.length > 0 ? serializeSpeechTiming(result.words) : null }`. Cuối hàm: `return { ok: true, transcript: result.transcript, fluency: computeFluencyStats(result.words) };`

- [ ] **Step 7: `components/transcribe-button.tsx`** — thêm prop `initialFluency: FluencyStats | null` (import type từ `@/lib/speech-fluency`, cùng `formatFluencyLine`), state `const [fluency, setFluency] = useState(initialFluency);`, khi ok `setFluency(result.fluency);`. Trong khung bản phiên âm, ngay sau `<p className="mt-1 whitespace-pre-wrap …">{transcript}</p>`:

```tsx
          {fluency ? (
            <p className="mt-2 text-xs text-muted-foreground">{formatFluencyLine(fluency)}</p>
          ) : null}
```

- [ ] **Step 8: `lib/ai-grading/input.ts`** — `ANSWER_ROW_SELECT` thêm `speechTimingJson: true,` (dưới `transcript: true`); `AnswerRow` thêm `speechTimingJson?: string | null;` (tuỳ chọn để fixture test cũ không phải sửa).

- [ ] **Step 9: `lib/ai-grading/grade-attempt.ts`** — import `parseSpeechTiming, serializeSpeechTiming, type TimedWord` từ `@/lib/speech-fluency`. Thêm mốc giả:

```ts
// Mốc giả cho FAKE_TRANSCRIPT: có một chỗ ngừng 1,6 giây giữa cụm từ để kiểm luồng.
function fakeWords(): TimedWord[] {
  let at = 0.3;
  return FAKE_TRANSCRIPT.split(" ").map((w, index) => {
    if (index === 4) at += 1.6;
    const word = { w, s: Math.round(at * 100) / 100, e: Math.round((at + 0.3) * 100) / 100 };
    at += 0.35;
    return word;
  });
}
```

Thay thân `ensureSpeakingTranscripts`:

```ts
// Speaking: câu nào chưa có bản phiên âm KÈM mốc thời gian thì phiên âm bằng Groq rồi
// lưu cả hai cột (thầy cũng thấy ở trang chấm). Bài cũ có chữ mà chưa có mốc → phiên âm
// lại một lần để đo độ trôi chảy; lần đó lỗi thì vẫn chấm bằng chữ cũ. Bản ghi RỖNG
// (file 0 byte do tải lên hỏng) thì bỏ qua câu đó; lỗi khác khi chưa có chữ → lỗi cả lượt.
async function ensureSpeakingTranscripts(rows: AnswerRow[]): Promise<void> {
  for (const row of rows) {
    if (row.assignableUnit.skill !== "speaking") continue;
    if (!row.value || !isAudioUrl(row.value)) continue;
    const hasText = Boolean(row.transcript?.trim());
    if (hasText && parseSpeechTiming(row.speechTimingJson)) continue;

    const result = isFakeGrading()
      ? { ok: true as const, transcript: FAKE_TRANSCRIPT, words: fakeWords() }
      : await transcribeAudioUrl(row.value);

    if (!result.ok) {
      if (result.reason === "empty" || hasText) continue;
      throw new AiCallError(`Không phiên âm được bản ghi: ${result.error}`);
    }

    const timing = result.words.length > 0 ? serializeSpeechTiming(result.words) : null;
    row.transcript = result.transcript;
    row.speechTimingJson = timing;
    await prisma.answer.update({
      where: { id: row.id },
      data: { transcript: result.transcript, speechTimingJson: timing }
    });
  }
}
```

- [ ] **Step 10:** `npx tsc --noEmit -p .` sạch; `npx vitest run` toàn bộ PASS.

- [ ] **Step 11: Commit** — `git add -A lib/groq-transcribe.ts prisma/schema.prisma scripts/ensure-db.mjs lib/actions/transcribe.ts components/transcribe-button.tsx lib/ai-grading/input.ts lib/ai-grading/grade-attempt.ts tests/groq-transcribe.test.ts && git commit -m "feat(phien-am): lay moc thoi gian tung tu tu Groq, luu Answer.speechTimingJson"`

(Trang chấm truyền `initialFluency` ở Task 4; tới đó tạm truyền `initialFluency={null}` để build qua.)

---

### Task 3: Đưa số đo + dấu ngừng vào prompt AI chấm

**Files:**
- Modify: `lib/ai-grading/types.ts` (`GradingAnswer`), `lib/ai-grading/input.ts`, `lib/ai-grading/prompt.ts`, `lib/ai-grading/validate.ts`
- Test: `tests/ai-input-prompt.test.ts`, `tests/ai-validate.test.ts`

**Interfaces:**
- Consumes: `parseSpeechTiming`, `computeFluencyStats`, `combineFluencyStats`, `annotatePauses`, `formatFluencyForModel`, `stripPauseMarkers`, `FluencyStats` (Task 1); `AnswerRow.speechTimingJson` (Task 2).
- Produces: `GradingAnswer.fluency?: FluencyStats`, `GradingAnswer.promptText?: string`.

- [ ] **Step 1: Test** — thêm vào `tests/ai-input-prompt.test.ts` (import thêm `serializeSpeechTiming` từ `@/lib/speech-fluency`):

```ts
describe("Speaking có mốc thời gian", () => {
  const speakingUnit = unit({ id: "s1", title: "Part 1", skill: "speaking", unitNumber: 1 });
  const timing = serializeSpeechTiming([
    { w: "I", s: 0.1, e: 0.3 },
    { w: "live", s: 0.3, e: 0.6 },
    { w: "in", s: 0.6, e: 0.8 },
    { w: "Hanoi", s: 2.4, e: 2.9 },
    { w: "city.", s: 2.9, e: 3.4 }
  ]);
  const rows: AnswerRow[] = [
    { id: "s-a", value: "https://x.public.blob.vercel-storage.com/a.webm", transcript: "I live in Hanoi city.", speechTimingJson: timing, isCorrect: null, question: { order: 1, prompt: "Where do you live?" }, assignableUnit: speakingUnit },
    { id: "s-b", value: "https://x.public.blob.vercel-storage.com/b.webm", transcript: "Yes I do.", speechTimingJson: null, isCorrect: null, question: { order: 2, prompt: "Do you work?" }, assignableUnit: speakingUnit }
  ];

  it("text vẫn là bản phiên âm sạch; promptText có dấu ngừng", () => {
    const answers = buildGradingInput(rows)!.tasks[0].answers;
    expect(answers[0].text).toBe("I live in Hanoi city.");
    expect(answers[0].promptText).toBe("I live in (pause 1.6s) Hanoi city.");
    expect(answers[0].fluency?.midPhrasePausesOver1s).toBe(1);
    expect(answers[1].promptText).toBeUndefined();
    expect(answers[1].fluency).toBeUndefined();
  });

  it("prompt có dòng Timing từng câu + tổng, gửi bản có dấu ngừng", () => {
    const input = buildGradingInput(rows)!;
    const text = buildGradingMessages(input, input.tasks[0]).userParts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n");
    expect(text).toContain("Overall timing (answers with timing data):");
    // 5 từ trong 3,3 giây → 91 từ/phút.
    expect(text).toContain("Timing: 91 words/min · pauses ≥1s: 1 (1 mid-phrase)");
    expect(text).toContain("I live in (pause 1.6s) Hanoi city.");
    expect(text).toContain("Timing: not available");
  });

  it("system prompt Speaking giải thích dấu ngừng, cấm trích số", () => {
    const system = buildSystemPrompt("speaking", 2);
    expect(system).toContain("(pause 2.1s)");
    expect(system).toContain("mid-phrase");
    expect(system).toContain("never quote the numbers");
    expect(system).toContain("removes hesitations");
  });
});
```

Thêm vào `tests/ai-validate.test.ts` một ca: model trả quote `"live in (pause 1.6s) Hanoi"` với answer text `"I live in Hanoi city."` → lỗi được giữ, `quote` = `"live in Hanoi"`. (Viết theo khuôn các ca Speaking/Writing sẵn có trong file — dùng cùng hàm dựng `task`/`output` của file đó.)

- [ ] **Step 2: Chạy** `npx vitest run tests/ai-input-prompt.test.ts tests/ai-validate.test.ts` → FAIL.

- [ ] **Step 3: `types.ts`** — `GradingAnswer` thêm:

```ts
  // Speaking có mốc thời gian (lib/speech-fluency.ts): số đo độ trôi chảy và bản
  // phiên âm chèn "(pause Ns)" — CHỈ dùng trong prompt; "text" vẫn là chữ sạch để
  // đối chiếu đoạn trích lỗi.
  fluency?: FluencyStats;
  promptText?: string;
```

(import type `FluencyStats` từ `@/lib/speech-fluency`.)

- [ ] **Step 4: `input.ts`** — trong nhánh Speaking, `.map((row) => …)` thành:

```ts
      .map((row) => {
        const words = parseSpeechTiming(row.speechTimingJson);
        const fluency = words ? computeFluencyStats(words) : null;
        return {
          answerId: row.id,
          ref: nextRef(),
          questionPrompt: row.question
            ? `${row.assignableUnit.title} · ${row.question.prompt}`
            : row.assignableUnit.title,
          text: (row.transcript ?? "").trim(),
          ...(words && fluency ? { fluency, promptText: annotatePauses(words) } : {})
        };
      });
```

(import `annotatePauses, computeFluencyStats, parseSpeechTiming` từ `@/lib/speech-fluency`.)

- [ ] **Step 5: `prompt.ts`** — import `combineFluencyStats, formatFluencyForModel` từ `@/lib/speech-fluency`. Thay khối `else { rules.push(...) }` của Speaking bằng:

```ts
    rules.push(
      "You only have an automatic speech-recognition transcript of the recording, not the audio. Do NOT grade Pronunciation.",
      "Speech recognition removes hesitations, fillers (um, uh) and false starts, so a clean transcript does NOT prove the speech was fluent.",
      'Most responses come with timing measured from the real audio: a "Timing" line (speaking rate in words per minute, silent pauses of 1 second or more, the longest pause) and markers such as (pause 2.1s) inside the transcript where the student was silent. A pause may also hide a filler the recogniser dropped.',
      "Use the timing as the main evidence for Fluency and Coherence. Pauses in the middle of a phrase or clause (mid-phrase) usually mean searching for words or grammar and should lower the band; pauses between sentences or ideas are less serious (content-related hesitation).",
      FLUENCY_REFERENCE,
      "Without timing data, be conservative with Fluency and Coherence: base it mainly on coherence, linking and how fully answers are developed, and do not award a band above the other criteria just because the transcript reads smoothly.",
      'In "reason" and "summary" you may describe the speed and pausing in words (for example: hesitates often in the middle of sentences), but never quote the numbers (words per minute, seconds or counts): the student does not see them.',
      "Never copy (pause …) markers into an error quote. Do not penalise punctuation or capitalisation of the transcript.",
      "The transcript may contain recognition mistakes: only list an error when you are confident it was really said.",
      ""
    );
```

Thêm hằng số trên `buildSystemPrompt`:

```ts
// Mức tham khảo tốc độ nói ↔ band Fluency — gần đúng, chỉnh dần khi đối chiếu với điểm
// thầy chấm (spec 2026-10-06-speaking-fluency-timing-design.md).
const FLUENCY_REFERENCE =
  "Rough reference only, not a rule: under about 100 words/min with frequent mid-phrase pauses usually fits Fluency band 5-5.5; about 100-120 words/min fits 5.5-6; about 120-140 words/min with few mid-phrase pauses can reach 6.5-7. A fast rate with many mid-phrase pauses should still not be graded high.";
```

Trong `buildGradingMessages`, nhánh Speaking:

```ts
    const blocks = task.answers.map((answer) =>
      [
        `Question (${answer.ref}): ${answer.questionPrompt ?? "(no question text)"}`,
        `Timing: ${answer.fluency ? formatFluencyForModel(answer.fluency) : "not available"}`,
        `<response ref="${answer.ref}">`,
        fence(answer.promptText ?? answer.text),
        "</response>"
      ].join("\n")
    );
    const overall = combineFluencyStats(
      task.answers.flatMap((answer) => (answer.fluency ? [answer.fluency] : []))
    );
    const header = overall
      ? `SPEAKING TEST TRANSCRIPT\nOverall timing (answers with timing data): ${formatFluencyForModel(overall)}`
      : "SPEAKING TEST TRANSCRIPT";
    parts.push({ type: "text", text: `${header}\n\n${blocks.join("\n\n")}` });
```

- [ ] **Step 6: `validate.ts`** — import `stripPauseMarkers` từ `@/lib/speech-fluency`; đổi dòng lấy quote: `const quote = stripPauseMarkers(String(item?.quote ?? ""));`

- [ ] **Step 7:** `npx vitest run` toàn bộ PASS (sửa ca test cũ nào còn kiểm câu prompt Speaking cũ cho khớp câu mới — chủ đích).

- [ ] **Step 8: Commit** — `git commit -am "feat(ai-cham): dua toc do noi + dau ngung vao prompt cham Fluency Speaking"`

---

### Task 4: Thầy xem số đo ở trang chấm

**Files:**
- Modify: `app/teacher/review/[attemptId]/page.tsx`

**Interfaces:**
- Consumes: `parseSpeechTiming`, `computeFluencyStats`, `combineFluencyStats`, `formatFluencyLine` (Task 1); `TranscribeButton` prop `initialFluency` (Task 2).

- [ ] **Step 1:** Import `combineFluencyStats, computeFluencyStats, formatFluencyLine, parseSpeechTiming, type FluencyStats` từ `@/lib/speech-fluency`. Sau `firstSpeakingAnswerId`:

```ts
  // Số đo độ trôi chảy từng câu Nói (chỉ thầy thấy) — câu chưa có mốc thời gian thì bỏ.
  const fluencyByAnswer = new Map<string, FluencyStats>();
  for (const answer of essayUnits.flatMap((entry) => entry.answers)) {
    if (answer.assignableUnit.skill !== "speaking") continue;
    const words = parseSpeechTiming(answer.speechTimingJson);
    const stats = words ? computeFluencyStats(words) : null;
    if (stats) fluencyByAnswer.set(answer.id, stats);
  }
  const overallFluency = combineFluencyStats(Array.from(fluencyByAnswer.values()));
```

- [ ] **Step 2:** Dưới tiêu đề `Bài làm của học viên` (`<h3>`):

```tsx
              {overallFluency ? (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Độ trôi chảy cả bài (đo từ audio): </span>
                  {formatFluencyLine(overallFluency)}
                </p>
              ) : null}
```

- [ ] **Step 3:** `<TranscribeButton … initialFluency={fluencyByAnswer.get(answer.id) ?? null} />`.

- [ ] **Step 4:** `npx tsc --noEmit -p .`, `pnpm lint`, `npx vitest run` sạch.

- [ ] **Step 5: Commit** — `git commit -am "feat(cham-bai): hien toc do noi + cho ngung o trang cham Speaking cua thay"`

---

### Task 5: Kiểm thật

- [ ] **Step 1:** `pnpm build` thành công (chạy cả `ensure-db`).
- [ ] **Step 2 (local, AI_GRADING_FAKE=1):** chạy `pnpm dev`, mở trang chấm một bài Speaking local (vai thầy) → bấm "AI chấm nháp" → kiểm dòng "Độ trôi chảy cả bài" + dòng dưới từng câu hiện; bản phiên âm KHÔNG có "(pause".
- [ ] **Step 3:** Push `feature/ielts-platform-mvp`; đợi Vercel deploy xong; kiểm runtime log `ensure-db` thêm cột.
- [ ] **Step 4 (prod, Chrome vai thầy, mở trang MỚI sau deploy):** bài Speaking đã chấm 5/10 → bấm "AI chấm nháp" (bài cũ sẽ phiên âm lại lấy mốc) → so Fluency với band thầy 5.5; chụp dòng số đo. Ghi kết quả vào memory `ai-grading-writing-speaking.md`.
