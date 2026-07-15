import { describe, expect, it } from "vitest";
import { actionFail, actionOk } from "../lib/action-result";

describe("actionOk", () => {
  it("đánh dấu thành công và giữ nguyên thông điệp", () => {
    expect(actionOk("Đã lưu câu 40.")).toEqual({ ok: true, message: "Đã lưu câu 40." });
  });
});

describe("actionFail", () => {
  it("ghép tiền tố với thông điệp của Error", () => {
    expect(actionFail(new Error("Đáp án phải là JSON hợp lệ."), "Lưu câu 40")).toEqual({
      ok: false,
      message: "Lưu câu 40 thất bại: Đáp án phải là JSON hợp lệ."
    });
  });

  it("dùng câu mặc định khi ném thứ không phải Error", () => {
    expect(actionFail("chuỗi ném thẳng", "Lưu câu 40")).toEqual({
      ok: false,
      message: "Lưu câu 40 thất bại: Có lỗi không xác định."
    });
  });

  it("dùng câu mặc định khi Error rỗng hoặc chỉ có khoảng trắng", () => {
    expect(actionFail(new Error("   "), "Xoá phần")).toEqual({
      ok: false,
      message: "Xoá phần thất bại: Có lỗi không xác định."
    });
  });
});
