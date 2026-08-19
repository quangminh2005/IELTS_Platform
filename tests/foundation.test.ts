import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("foundation slice", () => {
  it("defines the required Prisma domain enums and models", () => {
    const schema = readProjectFile("prisma/schema.prisma");

    // Dùng regex `\s+` chứ không so chuỗi cứng: `prisma format` canh lại cột mỗi
    // khi tên trường dài nhất trong model đổi, nên so cứng sẽ vỡ vì lý do vô nghĩa.
    expect(schema).toMatch(/role\s+String/);
    expect(schema).toMatch(/skill\s+String/);
    expect(schema).toMatch(/unitType\s+String/);
    expect(schema).toMatch(/mode\s+String\s+@default\("homework"\)/);
    expect(schema).toMatch(/status\s+String\s+@default\("assigned"\)/);
    expect(schema).toMatch(/status\s+String\s+@default\("in_progress"\)/);
    expect(schema).toMatch(/submitReason\s+String\?/);
    expect(schema).toMatch(/answerEvidence\s+String\?/);
    expect(schema).toMatch(/evidenceSnapshot\s+String\?/);

    for (const modelName of [
      "User",
      "TeacherProfile",
      "StudentProfile",
      "Class",
      "ClassStudent",
      "Material",
      "AssignableUnit",
      "Question",
      "Assignment",
      "AssignmentUnit",
      "AssignmentRecipient",
      "Attempt",
      "AttemptSkill",
      "Answer",
      "Highlight",
      "TeacherReview",
    ]) {
      expect(schema).toContain(`model ${modelName}`);
    }

    for (const fieldName of [
      "googleId",
      "sourceLabel",
      "metadataJson",
      "optionsJson",
      "correctAnswerJson",
      "customTimeLimitMinutes",
      "elapsedSeconds",
      "tabSwitchCount",
      "findAttemptCount",
      "criteriaScoresJson",
      "skillTimeLimitsJson",
      "@@unique([attemptId])",
    ]) {
      expect(schema).toContain(fieldName);
    }
  });

  it("seeds demo accounts, classes, materials, and units for all IELTS skills", () => {
    const seed = readProjectFile("prisma/seed.ts");
    const seedData = readProjectFile("lib/seed-data.ts");
    const seedSurface = `${seed}\n${seedData}`;

    expect(seed).toContain("teacher@example.com");
    expect(seed).toContain("teacher123");
    expect(seed).toContain("student@example.com");
    expect(seed).toContain("student123");

    for (const skill of ["reading", "listening", "writing", "speaking"]) {
      expect(seedSurface).toContain(`skill: "${skill}"`);
    }

    expect(seedSurface).toContain('unitType: "reading_passage"');
    expect(seed).toContain('mode: "homework"');
    expect(seed).toContain('status: "assigned"');
    expect(seed).toContain("bcrypt");
    expect(seed).toContain("IELTS MVP Demo Class");
  });

  it("provides the Next.js app shell and Prisma singleton", () => {
    expect(readProjectFile("app/layout.tsx")).toContain("IELTS Platform");
    expect(readProjectFile("app/globals.css")).toContain("@tailwind base");
    expect(readProjectFile("lib/prisma.ts")).toContain("PrismaClient");
  });

  it("does not prefill teacher credentials on the login page", () => {
    const loginPage = readProjectFile("app/(auth)/login/teacher/page.tsx");

    expect(loginPage).not.toContain('useState("teacher@example.com")');
    expect(loginPage).not.toContain('useState("teacher123")');
  });

  it("presents the remembered Google account with a branded Google logo", () => {
    const loginPage = readProjectFile("app/(auth)/login/student/page.tsx");

    expect(loginPage).toContain("LAST_GOOGLE_ACCOUNT_KEY");
    expect(loginPage).toContain("GoogleLogo");
    expect(loginPage).toContain("Tiếp tục với");
    expect(loginPage).not.toContain(">G</span>");
  });

  it("asks for the role before showing a login form", () => {
    const rolePage = readProjectFile("app/(auth)/login/page.tsx");

    expect(rolePage).toContain("Bạn đăng nhập với vai trò nào?");
    expect(rolePage).toContain("readPreferredRole");
    expect(rolePage).toContain("savePreferredRole");
    // Trang chọn vai trò không được chứa form đăng nhập.
    expect(rolePage).not.toContain('type="password"');
    expect(rolePage).not.toContain('signIn("google"');
  });

  it("remembers the teacher email but never the password", () => {
    const preferences = readProjectFile("lib/auth-preferences.ts");
    const teacherPage = readProjectFile("app/(auth)/login/teacher/page.tsx");

    expect(preferences).toContain("PREFERRED_ROLE_KEY");
    expect(preferences).toContain("REMEMBERED_TEACHER_EMAIL_KEY");
    expect(preferences).not.toMatch(/password/i);

    expect(teacherPage).toContain("saveRememberedTeacherEmail(email)");
    expect(teacherPage).not.toContain("saveRememberedTeacherEmail(password)");
    // Mật khẩu do trình duyệt lưu — form phải có name + autoComplete để nó nhận diện.
    expect(teacherPage).toContain('autoComplete="current-password"');
    expect(teacherPage).toContain('name="password"');
  });

  it("links assigned student work to the practice workspace", () => {
    const studentDashboard = readProjectFile("app/student/page.tsx");

    // Bài chưa làm xong -> mở phòng làm bài; bài đã nộp -> xem kết quả (làm một lần).
    expect(studentDashboard).toContain("/student/assignments/${recipient.id}");
    expect(studentDashboard).toContain("/student/results/${latestAttempt.id}");
    expect(studentDashboard).not.toContain("Practice page pending");
  });
});

describe("import dẫn chứng", () => {
  it("import map evidence -> answerEvidence", () => {
    const src = readProjectFile("lib/actions/materials.ts");
    expect(src).toContain("evidence: z.string().trim().optional()");
    expect(src).toContain("answerEvidence: optionalText(question.evidence)");
  });
});

describe("link báo cáo cho phụ huynh", () => {
  it("schema.prisma khai báo parentToken là cột unique", () => {
    const schema = readProjectFile("prisma/schema.prisma");
    const start = schema.indexOf("model StudentProfile");
    const model = schema.slice(start, schema.indexOf("\nmodel ", start + 10));

    expect(model).toMatch(/parentToken\s+String\?\s+@unique/);
  });

  it("ensure-db.mjs áp cột và unique index lên production", () => {
    const script = readProjectFile("scripts/ensure-db.mjs");

    expect(script).toContain('"parentToken"');
    expect(script).toContain("StudentProfile_parentToken_key");
  });

  // Kênh gửi báo cáo qua mail đã bỏ (phụ huynh ít dùng mail) — chỉ còn link.
  // Test này giữ cho code không lặng lẽ mọc lại đường gửi mail.
  it("không còn cron hay module gửi mail báo cáo phụ huynh", () => {
    const vercelConfig = readProjectFile("vercel.json");

    expect(vercelConfig).not.toContain("parent-reports");
    expect(existsSync(join(root, "lib/parent-report-email.ts"))).toBe(false);
    expect(existsSync(join(root, "app/api/cron/parent-reports/route.ts"))).toBe(false);
  });
});
