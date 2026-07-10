import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("foundation slice", () => {
  it("defines the required Prisma domain enums and models", () => {
    const schema = readProjectFile("prisma/schema.prisma");

    expect(schema).toContain("role           String");
    expect(schema).toContain("skill       String");
    expect(schema).toContain("unitType                String");
    expect(schema).toContain('mode             String                @default("homework")');
    expect(schema).toMatch(/status\s+String\s+@default\("assigned"\)/);
    expect(schema).toContain('status                String              @default("in_progress")');
    expect(schema).toContain("submitReason          String?");
    expect(schema).toContain("answerEvidence    String?");
    expect(schema).toContain("evidenceSnapshot      String?");

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
    const loginPage = readProjectFile("app/(auth)/login/page.tsx");

    expect(loginPage).not.toContain('useState("teacher@example.com")');
    expect(loginPage).not.toContain('useState("teacher123")');
  });

  it("presents the remembered Google account with a branded Google logo", () => {
    const loginPage = readProjectFile("app/(auth)/login/page.tsx");

    expect(loginPage).toContain("LAST_GOOGLE_ACCOUNT_KEY");
    expect(loginPage).toContain("GoogleLogo");
    expect(loginPage).toContain("Tiếp tục với");
    expect(loginPage).not.toContain(">G</span>");
  });

  it("links assigned student work to the practice workspace", () => {
    const studentDashboard = readProjectFile("app/student/page.tsx");

    // Bài chưa làm xong -> mở phòng làm bài; bài đã nộp -> xem kết quả (làm một lần).
    expect(studentDashboard).toContain("/student/assignments/${recipient.id}");
    expect(studentDashboard).toContain("/student/results/${latestAttempt.id}");
    expect(studentDashboard).not.toContain("Practice page pending");
  });
});
