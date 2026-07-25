import { describe, expect, it } from "vitest";
import {
  buildSentenceTimes,
  buildTranscriptTiming,
  evidenceOrderTimes,
  findSentenceRanges,
  groupSegmentsBySentence,
  normalizeToken,
  parseTranscriptTiming,
  seekTime,
  tokenizeWithOffsets,
  type AsrWord
} from "@/lib/transcript-timing";

// Chuyển câu nói thành danh sách AsrWord cách nhau 0.5s, bắt đầu từ `from`.
function asr(text: string, from: number): AsrWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => ({ word, start: from + index * 0.5 }));
}

describe("normalizeToken / tokenizeWithOffsets", () => {
  it("thường hóa và bỏ ký tự không phải chữ/số", () => {
    expect(normalizeToken("Hello,")).toBe("hello");
    expect(normalizeToken("don't")).toBe("dont");
    expect(normalizeToken("(Pause)")).toBe("pause");
  });

  it("tách từ kèm vị trí ký tự", () => {
    const tokens = tokenizeWithOffsets("Hi there, I'm Anna.");
    expect(tokens.map((t) => t.norm)).toEqual(["hi", "there", "im", "anna"]);
    expect(tokens[0]).toMatchObject({ start: 0, end: 2 });
    // "I'm" là MỘT từ (giống Whisper), giữ nguyên khoảng ký tự.
    expect(tokens[2]).toMatchObject({ start: 10, end: 13 });
  });
});

describe("buildTranscriptTiming", () => {
  const transcript = [
    "SECTION 1",
    "Natasha: Good evening, this is WebNet and you're speaking with Natasha.",
    "(Pause)",
    "Michael: Hello Natasha. I forgot my password."
  ].join("\n");

  // Audio chỉ đọc lời thoại, không đọc tiêu đề/tên người nói/(Pause).
  const spoken = [
    ...asr("Good evening this is WebNet and you're speaking with Natasha", 30),
    ...asr("Hello Natasha I forgot my password", 40)
  ];

  it("gán đúng giây cho từ khớp trực tiếp", () => {
    const timing = buildTranscriptTiming(transcript, spoken);
    const byWord = new Map(timing.words.map((w) => [w.w, w.t]));
    expect(byWord.get("good")).toBe(30);
    expect(byWord.get("evening")).toBe(30.5);
    expect(byWord.get("hello")).toBe(40);
    expect(byWord.get("password")).toBe(42.5);
  });

  it("nội suy/kẹp thời gian cho từ không được đọc và giữ thứ tự không giảm", () => {
    const timing = buildTranscriptTiming(transcript, spoken);
    // "section" đứng trước mốc đầu tiên -> kẹp về 30.
    expect(timing.words[0].w).toBe("section");
    expect(timing.words[0].t).toBe(30);
    for (let i = 1; i < timing.words.length; i++) {
      expect(timing.words[i].t).toBeGreaterThanOrEqual(timing.words[i - 1].t);
    }
  });

  it("vẫn khớp phần còn lại khi ASR nghe sai vài từ", () => {
    const misheard = [
      ...asr("Good morning this is WebNet and you're speaking with Natasha", 30)
    ];
    const timing = buildTranscriptTiming(transcript, misheard);
    const byWord = new Map(timing.words.map((w) => [w.w, w.t]));
    expect(byWord.get("good")).toBe(30);
    // "evening" (ASR nghe thành "morning") được nội suy giữa hai mốc lân cận.
    expect(byWord.get("webnet")).toBe(32);
  });

  it("audio khác nội dung -> matchRatio thấp", () => {
    const other = asr(
      "completely different recording about volcanoes and geology lectures today",
      0
    );
    const timing = buildTranscriptTiming(transcript, other);
    expect(timing.matchRatio).toBeLessThan(0.3);
  });

  it("audio đúng nội dung -> matchRatio cao", () => {
    const timing = buildTranscriptTiming(transcript, spoken);
    expect(timing.matchRatio).toBeGreaterThan(0.6);
  });

  it("không khớp được từ nào -> words rỗng", () => {
    const timing = buildTranscriptTiming("alpha beta", asr("gamma delta", 0));
    expect(timing.words).toEqual([]);
    expect(timing.matchRatio).toBe(0);
  });
});

describe("parseTranscriptTiming", () => {
  it("đọc JSON hợp lệ", () => {
    const json = JSON.stringify({ v: 1, matchRatio: 0.9, words: [{ w: "hi", t: 1 }] });
    expect(parseTranscriptTiming(json)?.words).toHaveLength(1);
  });

  it("null/hỏng/sai phiên bản -> null", () => {
    expect(parseTranscriptTiming(null)).toBeNull();
    expect(parseTranscriptTiming("not json")).toBeNull();
    expect(parseTranscriptTiming(JSON.stringify({ v: 2, words: [] }))).toBeNull();
  });
});

describe("findSentenceRanges", () => {
  it("tách theo dấu câu và xuống dòng, bỏ khoảng trắng", () => {
    const text = "First sentence. Second one!\nThird line";
    const ranges = findSentenceRanges(text);
    expect(ranges.map((r) => text.slice(r.start, r.end))).toEqual([
      "First sentence.",
      "Second one!",
      "Third line"
    ]);
  });
});

describe("buildSentenceTimes", () => {
  it("lấy giây của từ đầu tiên khớp trong mỗi câu", () => {
    const display = "Good evening everyone. I forgot my password.";
    const words = [
      { w: "good", t: 30 },
      { w: "evening", t: 30.5 },
      { w: "everyone", t: 31 },
      { w: "i", t: 40 },
      { w: "forgot", t: 40.5 },
      { w: "my", t: 41 },
      { w: "password", t: 41.5 }
    ];
    const sentences = buildSentenceTimes(display, words);
    expect(sentences).toHaveLength(2);
    expect(sentences[0].t).toBe(30);
    expect(sentences[1].t).toBe(40);
  });

  it("chịu được từ chèn thêm trong văn bản hiển thị (đáp án đã điền)", () => {
    // "319 Ocean Drive" được điền vào chỗ trống -> timing không có "319".
    const display = "The address is 319 Ocean Drive. Thanks a lot.";
    const words = [
      { w: "the", t: 10 },
      { w: "address", t: 10.5 },
      { w: "is", t: 11 },
      { w: "ocean", t: 12 },
      { w: "drive", t: 12.5 },
      { w: "thanks", t: 20 },
      { w: "a", t: 20.5 },
      { w: "lot", t: 21 }
    ];
    const sentences = buildSentenceTimes(display, words);
    expect(sentences[0].t).toBe(10);
    expect(sentences[1].t).toBe(20);
  });

  it("không có timing -> mọi câu t = null", () => {
    const sentences = buildSentenceTimes("Hello there. Bye now.", []);
    expect(sentences.every((s) => s.t === null)).toBe(true);
  });
});

describe("groupSegmentsBySentence", () => {
  it("cắt đoạn vắt qua ranh giới câu và gộp mảnh cùng câu", () => {
    const text = "One two. Three four.";
    const sentences = buildSentenceTimes(text, [
      { w: "one", t: 1 },
      { w: "two", t: 1.5 },
      { w: "three", t: 5 },
      { w: "four", t: 5.5 }
    ]);
    // Một đoạn duy nhất phủ cả hai câu (như khi không có dẫn chứng nào).
    const groups = groupSegmentsBySentence(
      [{ text, sentenceOrders: [], answerOrders: [] }],
      sentences
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].t).toBe(1);
    expect(groups[0].segments.map((s) => s.text).join("")).toBe("One two. ");
    expect(groups[1].t).toBe(5);
    expect(groups[1].segments.map((s) => s.text).join("")).toBe("Three four.");
  });

  it("ghép lại đủ nguyên văn khi có nhiều đoạn nhỏ", () => {
    const text = "Alpha beta. Gamma delta.";
    const segments = [
      { text: "Alpha ", sentenceOrders: [1], answerOrders: [] },
      { text: "beta", sentenceOrders: [1], answerOrders: [1] },
      { text: ". Gamma delta.", sentenceOrders: [], answerOrders: [] }
    ];
    const sentences = buildSentenceTimes(text, [
      { w: "alpha", t: 0 },
      { w: "beta", t: 0.5 },
      { w: "gamma", t: 3 },
      { w: "delta", t: 3.5 }
    ]);
    const groups = groupSegmentsBySentence(segments, sentences);
    const joined = groups.flatMap((g) => g.segments.map((s) => s.text)).join("");
    expect(joined).toBe(text);
    // Mảnh mang answerOrders vẫn giữ nguyên cờ sau khi cắt.
    const answerPiece = groups
      .flatMap((g) => g.segments)
      .find((s) => s.answerOrders.length > 0);
    expect(answerPiece?.text).toBe("beta");
  });
});

describe("evidenceOrderTimes", () => {
  it("lấy giây của nhóm đầu tiên chứa dẫn chứng của order", () => {
    const groups = [
      { t: 10, segments: [{ sentenceOrders: [1] }] },
      { t: 20, segments: [{ sentenceOrders: [1, 2] }] },
      { t: null, segments: [{ sentenceOrders: [3] }] }
    ];
    expect(evidenceOrderTimes(groups)).toEqual({ 1: 10, 2: 20 });
  });
});

describe("seekTime", () => {
  it("lùi 1 giây, không âm", () => {
    expect(seekTime(30)).toBe(29);
    expect(seekTime(0.4)).toBe(0);
  });
});
