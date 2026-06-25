import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  studentProfile: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock
}));

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
        name: "Demo Student"
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
        name: "Demo Student",
        role: "student"
      },
      create: {
        email: "student@example.com",
        googleId: "google-account-id",
        name: "Demo Student",
        role: "student"
      }
    });
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
        name: "New Student"
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
        emailVerified: null
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
