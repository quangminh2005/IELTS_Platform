// Số đo độ trôi chảy Speaking từ mốc thời gian từng từ của Groq (spec
// docs/superpowers/specs/2026-10-06-speaking-fluency-timing-design.md).
// Bản phiên âm bỏ hết "um, uh" và khoảng lặng nên đọc trôi chảy hơn thực tế; khoảng
// hở giữa hai từ liền nhau thì vẫn còn → đo được tốc độ nói và chỗ ngừng thật.

export type TimedWord = { w: string; s: number; e: number };

export type FluencyStats = {
  wordCount: number;
  // Từ đầu từ đầu tiên đến hết từ cuối (bỏ lặng trước/sau khi nói).
  speakingSeconds: number;
  // null = câu quá ngắn để kết luận (áp dụng cho cả 3 chỉ số tính theo thời lượng).
  wordsPerMinute: number | null;
  // Ngừng ngắn ≥ 0,5 giây (6/10/2026): người nói tốt vẫn ngừng ~0,5 giây giữa hai câu,
  // nhưng ngừng như vậy GIỮA cụm từ là dấu hiệu đang tìm từ.
  pausesOver05s: number;
  midPhrasePausesOver05s: number;
  // Số lần ngừng giữa cụm từ ≥ 0,5 giây trên mỗi phút nói — so được bài dài với bài ngắn.
  midPhrasePausesPerMinute: number | null;
  // Số mạch nói liền (ngăn bởi ngừng ≥ 0,5 giây); mỗi câu trả lời bắt đầu một mạch mới.
  runCount: number;
  // Độ dài mạch nói (mean length of run): số từ trung bình nói liền một hơi.
  meanLengthOfRun: number | null;
  pausesOver1s: number;
  pausesOver2s: number;
  // Ngừng khi từ đứng trước chưa hết câu/vế (không có dấu câu) = đang tìm từ.
  midPhrasePausesOver1s: number;
  longestPause: number;
};

export const SHORT_PAUSE_SECONDS = 0.5;
export const PAUSE_MIN_SECONDS = 1.0;
export const LONG_PAUSE_SECONDS = 2.0;
const MIN_SECONDS_FOR_RATE = 3;
const MIN_WORDS_FOR_RATE = 5;
const TIMING_VERSION = 1;

function endsClause(word: string): boolean {
  return /[.,?!;:…]["'”’)\]]?$/.test(word);
}

function enoughSpeech(wordCount: number, seconds: number): boolean {
  return wordCount >= MIN_WORDS_FOR_RATE && seconds >= MIN_SECONDS_FOR_RATE;
}

// Ba chỉ số phụ thuộc thời lượng: tốc độ, độ dài mạch nói, ngừng giữa cụm từ mỗi phút.
function derived(
  wordCount: number,
  speakingSeconds: number,
  runCount: number,
  midPhrasePausesOver05s: number
): Pick<FluencyStats, "wordsPerMinute" | "meanLengthOfRun" | "midPhrasePausesPerMinute"> {
  if (!enoughSpeech(wordCount, speakingSeconds)) {
    return { wordsPerMinute: null, meanLengthOfRun: null, midPhrasePausesPerMinute: null };
  }
  return {
    wordsPerMinute: Math.round((wordCount / speakingSeconds) * 60),
    meanLengthOfRun: wordCount / runCount,
    midPhrasePausesPerMinute: (midPhrasePausesOver05s / speakingSeconds) * 60
  };
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

  let pausesOver05s = 0;
  let midPhrasePausesOver05s = 0;
  let pausesOver1s = 0;
  let pausesOver2s = 0;
  let midPhrasePausesOver1s = 0;
  let longestPause = 0;

  for (let index = 1; index < words.length; index += 1) {
    const gap = words[index].s - words[index - 1].e;
    if (gap > longestPause) longestPause = gap;
    if (gap < SHORT_PAUSE_SECONDS) continue;
    const midPhrase = !endsClause(words[index - 1].w);
    pausesOver05s += 1;
    if (midPhrase) midPhrasePausesOver05s += 1;
    if (gap < PAUSE_MIN_SECONDS) continue;
    pausesOver1s += 1;
    if (gap >= LONG_PAUSE_SECONDS) pausesOver2s += 1;
    if (midPhrase) midPhrasePausesOver1s += 1;
  }

  const speakingSeconds = Math.max(0, words[words.length - 1].e - words[0].s);
  const runCount = pausesOver05s + 1;

  return {
    wordCount: words.length,
    speakingSeconds,
    ...derived(words.length, speakingSeconds, runCount, midPhrasePausesOver05s),
    pausesOver05s,
    midPhrasePausesOver05s,
    runCount,
    pausesOver1s,
    pausesOver2s,
    midPhrasePausesOver1s,
    longestPause
  };
}

export function combineFluencyStats(list: FluencyStats[]): FluencyStats | null {
  if (list.length === 0) return null;
  const sum = (pick: (item: FluencyStats) => number) => list.reduce((total, item) => total + pick(item), 0);
  const wordCount = sum((item) => item.wordCount);
  const speakingSeconds = sum((item) => item.speakingSeconds);
  const runCount = sum((item) => item.runCount);
  const midPhrasePausesOver05s = sum((item) => item.midPhrasePausesOver05s);
  return {
    wordCount,
    speakingSeconds,
    ...derived(wordCount, speakingSeconds, runCount, midPhrasePausesOver05s),
    pausesOver05s: sum((item) => item.pausesOver05s),
    midPhrasePausesOver05s,
    runCount,
    pausesOver1s: sum((item) => item.pausesOver1s),
    pausesOver2s: sum((item) => item.pausesOver2s),
    midPhrasePausesOver1s: sum((item) => item.midPhrasePausesOver1s),
    longestPause: Math.max(...list.map((item) => item.longestPause))
  };
}

// Bản phiên âm gửi model: chèn "(pause 0.6s)" ở mỗi khoảng lặng ≥ 0,5 giây.
export function annotatePauses(words: TimedWord[]): string {
  const parts: string[] = [];
  words.forEach((word, index) => {
    if (index > 0) {
      const gap = word.s - words[index - 1].e;
      if (gap >= SHORT_PAUSE_SECONDS) parts.push(`(pause ${gap.toFixed(1)}s)`);
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
    stats.meanLengthOfRun === null ? null : `trung bình ~${Math.round(stats.meanLengthOfRun)} từ mỗi mạch nói`,
    `ngừng giữa cụm từ ≥0,5 giây: ${stats.midPhrasePausesOver05s} lần`,
    `ngừng ≥1 giây: ${stats.pausesOver1s} lần (≥2 giây: ${stats.pausesOver2s})`,
    `lâu nhất ${seconds(stats.longestPause).replace(".", ",")} giây`
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

// Dòng "Timing" trong prompt gửi model.
export function formatFluencyForModel(stats: FluencyStats): string {
  const speed =
    stats.wordsPerMinute === null ? "speaking rate: too short to measure" : `${stats.wordsPerMinute} words/min`;
  const perMinute =
    stats.midPhrasePausesPerMinute === null ? "" : ` (${stats.midPhrasePausesPerMinute.toFixed(1)}/min)`;
  return [
    speed,
    stats.meanLengthOfRun === null ? null : `mean length of run ${stats.meanLengthOfRun.toFixed(1)} words`,
    `mid-phrase pauses ≥0.5s: ${stats.midPhrasePausesOver05s}${perMinute}`,
    `pauses ≥1s: ${stats.pausesOver1s} (${stats.midPhrasePausesOver1s} mid-phrase)`,
    `≥2s: ${stats.pausesOver2s}`,
    `longest ${seconds(stats.longestPause)}s`
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}
