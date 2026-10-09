import { describe, expect, it } from "vitest";
import { isLikelyHallucination } from "@/lib/transcript-hallucination";

// Thử 9/10/2026: gửi Groq file im lặng / chỉ có tiếng ồn 30 giây → " Thank you.". Trên prod
// có bài lưu bản phiên âm "Thank you. Thank you. ..." → AI chấm ra band 1.
describe("nhận diện bản phiên âm Whisper bịa", () => {
  it("chỉ toàn câu bịa quen thuộc → bịa", () => {
    expect(isLikelyHallucination(" Thank you.")).toBe(true);
    expect(isLikelyHallucination("Thank you. Thank you. Thank you Thank you. Thank you.")).toBe(true);
    expect(isLikelyHallucination("Thanks for watching!")).toBe(true);
    expect(isLikelyHallucination("Thank you for watching. Please subscribe.")).toBe(true);
    expect(isLikelyHallucination("Bye. Bye-bye.")).toBe(true);
    expect(isLikelyHallucination(" you")).toBe(true);
    expect(isLikelyHallucination("♪ ♪ ♪")).toBe(true);
  });

  it("trống → bịa", () => {
    expect(isLikelyHallucination("")).toBe(true);
    expect(isLikelyHallucination("  ...  ")).toBe(true);
  });

  it("một câu lặp đi lặp lại → bịa", () => {
    expect(isLikelyHallucination("I'm sorry. I'm sorry. I'm sorry.")).toBe(true);
    expect(
      isLikelyHallucination("Okay. Okay. Okay. Okay. I like it. Okay. Okay.")
    ).toBe(true);
  });

  it("bài nói thật → không bịa, kể cả có 'thank you' hay câu lặp lại hai lần", () => {
    expect(
      isLikelyHallucination(
        "Today I'm going to talk about a shop that I really enjoy going to. It is a convenience store near my house."
      )
    ).toBe(false);
    expect(isLikelyHallucination("I live in Hanoi with my family. Thank you.")).toBe(false);
    expect(isLikelyHallucination("Yes.")).toBe(false);
    expect(isLikelyHallucination("I like it. I like it. Because it is cheap and near my house.")).toBe(false);
  });
});
