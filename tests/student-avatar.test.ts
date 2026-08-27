import { describe, expect, it } from "vitest";
import {
  AVATAR_PRESETS,
  COVER_COLORS,
  isAllowedAvatarUrl,
  resolveStudentAvatar
} from "../lib/student-avatar";

const base = {
  avatarUrl: null,
  avatarPreset: null,
  userImage: null,
  displayName: "Nguyễn Hoàng An"
};

describe("resolveStudentAvatar", () => {
  it("ảnh tự tải thắng tất cả", () => {
    const result = resolveStudentAvatar({
      ...base,
      avatarUrl: "https://abc.public.blob.vercel-storage.com/avatars/x.webp",
      avatarPreset: "cat",
      userImage: "https://lh3.googleusercontent.com/a/anh-google"
    });
    expect(result).toEqual({
      kind: "image",
      src: "https://abc.public.blob.vercel-storage.com/avatars/x.webp"
    });
  });

  it("avatar có sẵn thắng ảnh Google — học viên chọn chủ động thì phải được tôn trọng", () => {
    const result = resolveStudentAvatar({
      ...base,
      avatarPreset: "cat",
      userImage: "https://lh3.googleusercontent.com/a/anh-google"
    });
    expect(result.kind).toBe("preset");
  });

  it("ảnh tự tải nằm ngoài host Blob bị bỏ qua, tụt xuống nguồn kế tiếp", () => {
    // Học viên sửa gói tin gửi lên có thể dán link bất kỳ. Không được để nó hiện
    // trên bảng xếp hạng của cả lớp.
    const result = resolveStudentAvatar({
      ...base,
      avatarUrl: "https://vi-du-doc-hai.com/anh.png",
      userImage: "https://lh3.googleusercontent.com/a/anh-google"
    });
    expect(result).toEqual({
      kind: "image",
      src: "https://lh3.googleusercontent.com/a/anh-google"
    });
  });

  it("mã avatar không có trong bảng thì bỏ qua, không nổ", () => {
    const result = resolveStudentAvatar({ ...base, avatarPreset: "khong-ton-tai" });
    expect(result.kind).toBe("initials");
  });

  it("không có gì thì ra chữ cái viết tắt", () => {
    const result = resolveStudentAvatar(base);
    expect(result).toMatchObject({ kind: "initials", text: "NA" });
  });

  it("tên một chữ lấy hai ký tự đầu", () => {
    const result = resolveStudentAvatar({ ...base, displayName: "An" });
    expect(result).toMatchObject({ kind: "initials", text: "AN" });
  });

  it("tên rỗng ra dấu hỏi thay vì nổ", () => {
    const result = resolveStudentAvatar({ ...base, displayName: "   " });
    expect(result).toMatchObject({ kind: "initials", text: "?" });
  });

  it("cùng một tên luôn ra cùng một màu", () => {
    const a = resolveStudentAvatar({ ...base, displayName: "Trần Bình" });
    const b = resolveStudentAvatar({ ...base, displayName: "Trần Bình" });
    expect(a).toEqual(b);
  });
});

describe("isAllowedAvatarUrl", () => {
  it("nhận host Blob của mình", () => {
    expect(
      isAllowedAvatarUrl("https://abc123.public.blob.vercel-storage.com/avatars/x.webp")
    ).toBe(true);
  });

  it("từ chối host lạ", () => {
    expect(isAllowedAvatarUrl("https://vi-du-doc-hai.com/anh.png")).toBe(false);
  });

  it("từ chối host giả mạo có đuôi giống", () => {
    expect(
      isAllowedAvatarUrl("https://public.blob.vercel-storage.com.doc-hai.com/x.webp")
    ).toBe(false);
  });

  it("từ chối http (không mã hoá)", () => {
    expect(
      isAllowedAvatarUrl("http://abc.public.blob.vercel-storage.com/x.webp")
    ).toBe(false);
  });

  it("từ chối chuỗi không phải link", () => {
    expect(isAllowedAvatarUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedAvatarUrl("")).toBe(false);
  });

  it("từ chối file đúng host Blob nhưng KHÔNG nằm trong thư mục avatars/ (vd. audio Listening)", () => {
    // Finding A (security): cùng một Blob store còn chứa audio Listening và ảnh
    // tài liệu (xem lib/audio-source.ts), tất cả chung hostname với avatar. Nếu
    // isAllowedAvatarUrl chỉ kiểm hostname, học viên dán được URL audio Listening
    // vào ô avatarUrl của mình, rồi đổi avatar lần nữa khiến deleteOldAvatar()
    // (lib/actions/profile.ts) xoá vĩnh viễn file audio của cả lớp — không khôi
    // phục được. Một URL Blob hợp lệ nhưng ngoài avatars/ phải bị từ chối.
    expect(
      isAllowedAvatarUrl(
        "https://abc123xyz.public.blob.vercel-storage.com/listening/cam20-test1-part1-aBcD12.mp3"
      )
    ).toBe(false);
  });

  it("nhận file đúng host Blob VÀ nằm trong thư mục avatars/", () => {
    // Đối chứng với test trên: một URL avatar hợp lệ thật sự (đúng tiền tố mà
    // route tải avatar app/api/student/avatar sẽ dùng) vẫn phải được chấp nhận.
    expect(
      isAllowedAvatarUrl(
        "https://abc123xyz.public.blob.vercel-storage.com/avatars/hoc-vien-1-aBcD12.webp"
      )
    ).toBe(true);
  });

  it("từ chối dấu / được mã hoá phần trăm để lách ra khỏi thư mục avatars/", () => {
    // Vá thêm sau review: "avatars/" khớp startsWith trên pathname vì pathname
    // vẫn giữ nguyên "%2F" chưa giải mã — nhưng nếu Blob store hiểu %2F như dấu
    // "/", URL này thực chất trỏ ra ngoài avatars/, vào thẳng thư mục audio
    // Listening. Nhiều khả năng vô hại nhưng cái giá đoán sai là xoá nhầm file
    // không khôi phục được, nên chặn hẳn mọi phần trăm-mã-hoá sau tiền tố.
    expect(
      isAllowedAvatarUrl(
        "https://abc123xyz.public.blob.vercel-storage.com/avatars/..%2Flistening/a.mp3"
      )
    ).toBe(false);
  });
});

describe("bảng hằng số", () => {
  it("mã avatar không trùng nhau", () => {
    const keys = AVATAR_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("mã màu bìa không trùng nhau", () => {
    const keys = COVER_COLORS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
