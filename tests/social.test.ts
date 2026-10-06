import { describe, expect, it } from "vitest";
import {
  REACTIONS,
  foldVietnamese,
  friendScope,
  groupSocialNotifications,
  isReactionKind,
  namesSentence,
  searchStudents
} from "@/lib/social";

// Giờ VN = UTC+7: 2026-10-06T03:00Z = 10h sáng 6/10 giờ VN.
const at = (iso: string) => new Date(iso);

describe("REACTIONS / isReactionKind", () => {
  it("3 loại đúng thứ tự 👏 🔥 🎯", () => {
    expect(REACTIONS.map((item) => item.kind)).toEqual(["cheer", "fire", "target"]);
    expect(REACTIONS.map((item) => item.emoji).join("")).toBe("👏🔥🎯");
  });

  it("chỉ nhận đúng 3 mã", () => {
    expect(isReactionKind("fire")).toBe(true);
    expect(isReactionKind("like")).toBe(false);
    expect(isReactionKind(undefined)).toBe(false);
  });
});

describe("foldVietnamese", () => {
  it("bỏ dấu, chữ thường, gộp khoảng trắng", () => {
    expect(foldVietnamese("  Nguyễn  Anh Tuấn ")).toBe("nguyen anh tuan");
  });

  it("đ/Đ thành d", () => {
    expect(foldVietnamese("Đức Đạt")).toBe("duc dat");
  });
});

describe("searchStudents", () => {
  const people = [
    { id: "1", displayName: "Minh Tuấn" },
    { id: "2", displayName: "Tuấn Anh" },
    { id: "3", displayName: "Linh" },
    { id: "4", displayName: "Quân" }
  ];

  it("gõ không dấu vẫn tìm ra", () => {
    expect(searchStudents(people, "tuan").map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("khớp đầu từ xếp trước khớp giữa từ", () => {
    const list = [
      { displayName: "Quân" },
      { displayName: "Uân Bảo" }
    ];
    expect(searchStudents(list, "uan").map((p) => p.displayName)).toEqual(["Uân Bảo", "Quân"]);
  });

  it("ô trống → không có kết quả", () => {
    expect(searchStudents(people, "   ")).toEqual([]);
  });

  it("cắt theo limit", () => {
    expect(searchStudents(people, "n", 2)).toHaveLength(2);
  });
});

describe("namesSentence", () => {
  it("1, 2, 3 và nhiều người", () => {
    expect(namesSentence(["Linh"])).toBe("Linh");
    expect(namesSentence(["Linh", "Minh"])).toBe("Linh và Minh");
    expect(namesSentence(["Linh", "Minh", "An"])).toBe("Linh, Minh và 1 bạn khác");
    expect(namesSentence(["Linh", "Minh", "An", "Bo"])).toBe("Linh, Minh và 2 bạn khác");
  });
});

describe("groupSocialNotifications", () => {
  it("gộp cảm xúc cùng ngày: tên theo lần gửi đầu, emoji theo thứ tự cố định", () => {
    const groups = groupSocialNotifications(
      [],
      [
        { fromId: "m", name: "Minh", kind: "cheer", createdAt: at("2026-10-06T05:00:00Z") },
        { fromId: "l", name: "Linh", kind: "fire", createdAt: at("2026-10-06T03:00:00Z") }
      ]
    );
    expect(groups).toEqual([
      {
        kind: "reaction",
        dayKey: "2026-10-06",
        title: "Linh và Minh đã gửi 👏🔥 cho bạn",
        createdAt: at("2026-10-06T05:00:00Z")
      }
    ]);
  });

  it("một người gửi cả 3 loại → tên chỉ một lần", () => {
    const groups = groupSocialNotifications(
      [],
      [
        { fromId: "l", name: "Linh", kind: "target", createdAt: at("2026-10-06T03:00:00Z") },
        { fromId: "l", name: "Linh", kind: "cheer", createdAt: at("2026-10-06T03:01:00Z") },
        { fromId: "l", name: "Linh", kind: "fire", createdAt: at("2026-10-06T03:02:00Z") }
      ]
    );
    expect(groups.map((group) => group.title)).toEqual(["Linh đã gửi 👏🔥🎯 cho bạn"]);
  });

  it("tách theo ngày giờ VN (23h30 ngày 5 và 0h30 ngày 6)", () => {
    const groups = groupSocialNotifications(
      [],
      [
        { fromId: "l", name: "Linh", kind: "cheer", createdAt: at("2026-10-05T16:30:00Z") },
        { fromId: "l", name: "Linh", kind: "cheer", createdAt: at("2026-10-05T17:30:00Z") }
      ]
    );
    expect(groups.map((group) => group.dayKey)).toEqual(["2026-10-06", "2026-10-05"]);
  });

  it("theo dõi gộp riêng, sắp mới nhất trước", () => {
    const groups = groupSocialNotifications(
      [
        { followerId: "l", name: "Linh", createdAt: at("2026-10-06T08:00:00Z") },
        { followerId: "m", name: "Minh", createdAt: at("2026-10-06T09:00:00Z") },
        { followerId: "a", name: "An", createdAt: at("2026-10-06T09:30:00Z") }
      ],
      [{ fromId: "l", name: "Linh", kind: "fire", createdAt: at("2026-10-06T01:00:00Z") }]
    );
    expect(groups.map((group) => [group.kind, group.title])).toEqual([
      ["follow", "Linh, Minh và 1 bạn khác đã theo dõi bạn"],
      ["reaction", "Linh đã gửi 🔥 cho bạn"]
    ]);
  });
});

describe("friendScope", () => {
  it("gồm mình và người mình theo dõi", () => {
    expect(Array.from(friendScope("me", ["a", "b"])).sort()).toEqual(["a", "b", "me"]);
  });
});
