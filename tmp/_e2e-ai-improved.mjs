// Dựng (hoặc xoá với "undo") một lượt tự luyện Writing đã nộp trên DB LOCAL để kiểm
// "Bản nâng cấp" AI. Ghi id vào tmp/_e2e-ai-improved.json.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
const url = fs.readFileSync("E:/web_ielts/.env", "utf8").match(/^DATABASE_URL="?([^"\r\n]+)"?/m)[1];
const p = new PrismaClient({ datasources: { db: { url } } });
const file = "E:/web_ielts/tmp/_e2e-ai-improved.json";
if (process.argv[2] === "undo") {
  const ids = JSON.parse(fs.readFileSync(file, "utf8"));
  await p.assignment.delete({ where: { id: ids.assignmentId } });
  console.log("deleted", ids.assignmentId);
} else {
  const student = await p.studentProfile.findFirst({ where: { email: "student@example.com" } });
  const q = await p.question.findFirst({
    where: { questionType: "writing_task", assignableUnit: { skill: "writing" } },
    select: { id: true, assignableUnitId: true, assignableUnit: { select: { title: true, materialId: true, material: { select: { teacherId: true, title: true } } } } }
  });
  const essay = [
    "Nowadays, many people believes that technology make our life more easier. In this essay I will discuss about both views and give my opinion.",
    "",
    "On the one hand, technology help people to communicate with each others very fast. For example, my family use smartphone to call my grandmother every day. Moreover, students can learning online from home when they are busy.",
    "",
    "On the other hand, some people thinks that technology cause many problems. Children spend too much time for playing games and they don't do exercise. This is very bad for they health.",
    "",
    "In conclusion, I think technology have more advantages than disadvantages if we use it in a right way."
  ].join("\n");
  const a = await p.assignment.create({
    data: {
      teacherId: q.assignableUnit.material.teacherId, title: `E2E AI nâng cấp — ${q.assignableUnit.title}`, mode: process.argv[2] === "homework" ? "homework" : "practice",
      practiceScopeKey: process.argv[2] === "homework" ? null : `${student.id}:${q.assignableUnit.materialId}:${q.assignableUnitId}`,
      units: { create: [{ assignableUnitId: q.assignableUnitId, order: 1 }] },
      recipients: { create: [{ studentId: student.id, status: "submitted" }] }
    },
    include: { recipients: true }
  });
  const now = new Date();
  const attempt = await p.attempt.create({
    data: {
      assignmentRecipientId: a.recipients[0].id, studentId: student.id, status: "submitted", submittedAt: now, submitReason: "manual",
      skills: { create: [{ skill: "writing", status: "submitted", startedAt: now, submittedAt: now }] },
      answers: { create: [{ studentId: student.id, questionId: q.id, assignableUnitId: q.assignableUnitId, value: essay, isCorrect: null }] }
    }
  });
  fs.writeFileSync(file, JSON.stringify({ assignmentId: a.id, attemptId: attempt.id }));
  console.log({ attemptId: attempt.id, unit: q.assignableUnit.title });
}
await p.$disconnect();
