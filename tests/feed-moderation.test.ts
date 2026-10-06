import { describe, expect, it } from "vitest";
import { containsProfanity } from "@/lib/feed-moderation";

// Bộ lọc thô tục cơ bản cho bình luận bảng tin (Mạng xã hội Đợt 3).
describe("containsProfanity", () => {
  it("bắt từ thô tục có dấu, không dấu, viết hoa", () => {
    expect(containsProfanity("đồ ngu")).toBe(true);
    expect(containsProfanity("do NGU vay")).toBe(true);
    expect(containsProfanity("vl thật")).toBe(true);
    expect(containsProfanity("what the fuck")).toBe(true);
  });

  it("bắt kiểu tách chữ bằng dấu chấm / gạch / cách", () => {
    expect(containsProfanity("đ.m")).toBe(true);
    expect(containsProfanity("d-m bài khó")).toBe(true);
    expect(containsProfanity("c.c")).toBe(true);
  });

  it("không bắt nhầm từ thường", () => {
    for (const text of [
      "Giỏi lắm!",
      "đi mua sách",
      "class hay quá",
      "nguyên văn",
      "cục cưng cố lên",
      "dạy học vui",
      "Đề Cam 20 Test 1 khó ghê",
      "assignment tuần này"
    ]) {
      expect(containsProfanity(text), text).toBe(false);
    }
  });
});
