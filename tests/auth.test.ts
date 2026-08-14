import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_LOCKED_ERROR, MAX_FAILS_PER_EMAIL } from "../lib/login-lock";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  studentProfile: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  // Mặc định: chưa có lần đăng nhập sai nào -> không khoá.
  loginAttempt: {
    findMany: vi.fn(async () => []),
    create: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 }))
  }
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth options", () => {
  it("authorizes a credentials user with a valid password and role", async () => {
    const { authorizeCredentials } = await import("../lib/auth");
    const passwordHash = await bcrypt.hash("teacher123", 10);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "teacher-user-id",
      email: "teacher@example.com",
      name: "Ms. Trang",
      passwordHash,
      role: "teacher"
    });

    const user = await authorizeCredentials("teacher@example.com", "teacher123");

    expect(user).toEqual({
      id: "teacher-user-id",
      email: "teacher@example.com",
      name: "Ms. Trang",
      role: "teacher"
    });
  });

  it("từ chối tài khoản học viên dù mật khẩu đúng", async () => {
    const { authorizeCredentials } = await import("../lib/auth");
    const passwordHash = await bcrypt.hash("student123", 10);

    // Học viên bắt buộc đăng nhập bằng Google. Một tài khoản role "student" mà
    // có passwordHash chính là cổng đi vòng qua quy định đó.
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "student-user-id",
      email: "student@example.com",
      name: "Demo Student",
      passwordHash,
      role: "student"
    });

    const user = await authorizeCredentials("student@example.com", "student123");

    expect(user).toBeNull();
    expect(prismaMock.loginAttempt.create).toHaveBeenCalled();
  });

  it("ghi nhận lần đăng nhập sai và xoá sạch khi đăng nhập được", async () => {
    const { authorizeCredentials } = await import("../lib/auth");
    const passwordHash = await bcrypt.hash("teacher123", 10);

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "teacher-user-id",
      email: "teacher@example.com",
      name: "Ms. Trang",
      passwordHash,
      role: "teacher"
    });

    expect(await authorizeCredentials("teacher@example.com", "sai-mat-khau")).toBeNull();
    expect(prismaMock.loginAttempt.create).toHaveBeenCalledWith({
      data: { email: "teacher@example.com", ip: "unknown" }
    });

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "teacher-user-id",
      email: "teacher@example.com",
      name: "Ms. Trang",
      passwordHash,
      role: "teacher"
    });

    expect(await authorizeCredentials("teacher@example.com", "teacher123")).not.toBeNull();
    expect(prismaMock.loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { email: "teacher@example.com" }
    });
  });

  it("khoá tạm sau khi sai quá nhiều lần, không thèm kiểm mật khẩu nữa", async () => {
    const { authorizeCredentials } = await import("../lib/auth");
    const fails = Array.from({ length: MAX_FAILS_PER_EMAIL }, () => ({
      createdAt: new Date(Date.now() - 60_000)
    }));

    prismaMock.loginAttempt.findMany.mockResolvedValueOnce(fails as never);
    prismaMock.loginAttempt.findMany.mockResolvedValueOnce([] as never);

    await expect(
      authorizeCredentials("teacher@example.com", "teacher123", {
        "x-forwarded-for": "203.0.113.7"
      })
    ).rejects.toThrow(LOGIN_LOCKED_ERROR);

    // Đang khoá thì dừng ngay, không đọc tới bảng User.
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("DB lỗi khi đếm thì vẫn cho đăng nhập, không khoá cứng giáo viên", async () => {
    const { authorizeCredentials } = await import("../lib/auth");
    const passwordHash = await bcrypt.hash("teacher123", 10);

    prismaMock.loginAttempt.findMany.mockRejectedValueOnce(new Error("connection lost"));
    prismaMock.loginAttempt.findMany.mockRejectedValueOnce(new Error("connection lost"));
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "teacher-user-id",
      email: "teacher@example.com",
      name: "Ms. Trang",
      passwordHash,
      role: "teacher"
    });

    const user = await authorizeCredentials("teacher@example.com", "teacher123");

    expect(user).toMatchObject({ id: "teacher-user-id", role: "teacher" });
  });

  it("links Google sign-in to a pre-added student profile", async () => {
    const { authOptions } = await import("../lib/auth");

    prismaMock.studentProfile.findUnique.mockResolvedValueOnce({
      id: "student-profile-id",
      userId: null,
      email: "student@example.com",
      displayName: "Demo Student"
    });
    prismaMock.user.upsert.mockResolvedValueOnce({
      id: "student-user-id",
      email: "student@example.com",
      name: "Demo Student",
      role: "student",
      googleId: "google-account-id"
    });
    prismaMock.studentProfile.update.mockResolvedValueOnce({});

    const result = await authOptions.callbacks?.signIn?.({
      user: {
        id: "google-account-id",
        email: "student@example.com",
        name: "Demo Student",
        role: "student",
        emailVerified: null
      },
      account: {
        provider: "google",
        providerAccountId: "google-account-id",
        type: "oauth"
      },
      profile: {},
      email: undefined,
      credentials: undefined
    });

    expect(result).toBe(true);
    expect(prismaMock.user.upsert).toHaveBeenCalledWith({
      where: { email: "student@example.com" },
      update: {
        googleId: "google-account-id",
        name: "Demo Student"
      },
      create: {
        email: "student@example.com",
        googleId: "google-account-id",
        name: "Demo Student",
        role: "student"
      }
    });

    // Tài khoản ĐÃ tồn tại thì không được đụng tới role — nếu không, một email
    // giáo viên lỡ có StudentProfile sẽ bị hạ quyền mỗi lần đăng nhập Google.
    expect(prismaMock.user.upsert.mock.calls[0][0].update).not.toHaveProperty("role");
    expect(prismaMock.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "student-profile-id" },
      data: { userId: "student-user-id" }
    });
  });

  it("redirects Google sign-in to waiting when the student email is not pre-added", async () => {
    const { authOptions } = await import("../lib/auth");

    prismaMock.studentProfile.findUnique.mockResolvedValueOnce(null);

    const result = await authOptions.callbacks?.signIn?.({
      user: {
        id: "google-account-id",
        email: "new-student@example.com",
        name: "New Student",
        role: "student",
        emailVerified: null
      },
      account: {
        provider: "google",
        providerAccountId: "google-account-id",
        type: "oauth"
      },
      profile: {},
      email: undefined,
      credentials: undefined
    });

    expect(result).toBe("/waiting");
  });

  it("adds id and role to JWT and session users", async () => {
    const { authOptions } = await import("../lib/auth");

    const token = await authOptions.callbacks?.jwt?.({
      token: {},
      user: {
        id: "teacher-user-id",
        email: "teacher@example.com",
        name: "Ms. Trang",
        role: "teacher"
      },
      account: null,
      profile: undefined,
      trigger: "signIn",
      isNewUser: false,
      session: undefined
    });

    expect(token).toMatchObject({ id: "teacher-user-id", role: "teacher" });

    const session = await authOptions.callbacks?.session?.({
      session: {
        expires: "2099-01-01T00:00:00.000Z",
        user: { name: "Ms. Trang", email: "teacher@example.com", image: null }
      },
      token: { id: "teacher-user-id", role: "teacher" },
      user: {
        id: "teacher-user-id",
        email: "teacher@example.com",
        emailVerified: null,
        role: "teacher"
      },
      newSession: undefined,
      trigger: "update"
    });

    expect(session?.user).toMatchObject({
      id: "teacher-user-id",
      role: "teacher"
    });
  });

  it("exports a server auth helper for role-protected pages", async () => {
    const { auth } = await import("../lib/auth");

    expect(typeof auth).toBe("function");
  });
});
