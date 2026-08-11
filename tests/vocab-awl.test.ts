import { describe, expect, it } from "vitest";
import { AWL_HEADWORDS, academicRoot, isAcademicWord } from "../lib/vocab-awl";

describe("academicRoot", () => {
  it("bỏ 'e' cuối với từ dài hơn 4 chữ", () => {
    expect(academicRoot("create")).toBe("creat");
    expect(academicRoot("analyse")).toBe("analys");
  });

  it("bỏ 't' cuối ở đuôi -ant/-ent để bắt được dạng -ance/-ence", () => {
    expect(academicRoot("significant")).toBe("significan");
    expect(academicRoot("evident")).toBe("eviden");
  });

  it("giữ nguyên từ 4 chữ trở xuống để không khớp bừa", () => {
    expect(academicRoot("role")).toBe("role");
    expect(academicRoot("data")).toBe("data");
  });
});

describe("isAcademicWord", () => {
  it("nhận chính headword", () => {
    expect(isAcademicWord("significant")).toBe(true);
    expect(isAcademicWord("research")).toBe(true);
  });

  it("nhận các dạng biến thể trong cùng họ từ", () => {
    expect(isAcademicWord("created")).toBe(true);
    expect(isAcademicWord("creating")).toBe(true);
    expect(isAcademicWord("analysis")).toBe(true);
    expect(isAcademicWord("significance")).toBe(true);
    expect(isAcademicWord("assumption")).toBe(true);
  });

  it("loại từ thường ngày không thuộc danh sách", () => {
    expect(isAcademicWord("people")).toBe(false);
    expect(isAcademicWord("because")).toBe(false);
    expect(isAcademicWord("water")).toBe(false);
    expect(isAcademicWord("the")).toBe(false);
  });

  it("không khớp khi phần đuôi dài quá 5 chữ (tránh trùng nhầm)", () => {
    // "roll"/"rolling" không được ăn theo headword "role"
    expect(isAcademicWord("rolling")).toBe(false);
  });

  it("danh sách không có phần tử trùng nhau", () => {
    expect(new Set(AWL_HEADWORDS).size).toBe(AWL_HEADWORDS.length);
  });
});
