import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { demoMaterials } from "../lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  const teacherPassword = await bcrypt.hash("teacher123", 10);
  const studentPassword = await bcrypt.hash("student123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {
      passwordHash: teacherPassword,
      role: "teacher",
      name: "Ms. Trang"
    },
    create: {
      email: "teacher@example.com",
      passwordHash: teacherPassword,
      role: "teacher",
      name: "Ms. Trang"
    }
  });

  const student = await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {
      passwordHash: studentPassword,
      role: "student",
      name: "Demo Student"
    },
    create: {
      email: "student@example.com",
      passwordHash: studentPassword,
      role: "student",
      name: "Demo Student"
    }
  });

  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { userId: teacher.id },
    update: { displayName: "Ms. Trang" },
    create: {
      userId: teacher.id,
      displayName: "Ms. Trang"
    }
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: { email: "student@example.com" },
    update: {
      userId: student.id,
      displayName: "Demo Student"
    },
    create: {
      userId: student.id,
      email: "student@example.com",
      displayName: "Demo Student"
    }
  });

  const demoClass = await prisma.class.create({
    data: {
      name: "IELTS MVP Demo Class",
      description: "Seeded class for the foundation MVP slice.",
      teacherId: teacherProfile.id,
      students: {
        create: {
          studentId: studentProfile.id
        }
      }
    }
  });

  const seededUnits = [];

  for (const material of demoMaterials) {
    const createdMaterial = await prisma.material.create({
      data: {
        title: material.title,
        skill: material.skill,
        sourceLabel: material.sourceLabel,
        description: material.description,
        teacherId: teacherProfile.id,
        units: {
          create: material.units.map((unit) => ({
            skill: material.skill,
            unitType: unit.unitType,
            unitNumber: unit.unitNumber,
            title: unit.title,
            instructions: unit.instructions,
            content: unit.content,
            audioUrl: unit.audioUrl,
            transcript: unit.transcript,
            defaultTimeLimitMinutes: unit.defaultTimeLimitMinutes,
            metadataJson: unit.metadataJson,
            questions: {
              create: unit.questions.map((question, questionIndex) => ({
                order: questionIndex + 1,
                questionType: question.questionType,
                prompt: question.prompt,
                optionsJson: question.optionsJson,
                correctAnswerJson: question.correctAnswerJson,
                explanation: question.explanation,
                points: question.points ?? 1
              }))
            }
          }))
        }
      },
      include: {
        units: true
      }
    });

    seededUnits.push(...createdMaterial.units);
  }

  const readingUnit = seededUnits.find((unit) => unit.unitType === "reading_passage");
  const listeningUnit = seededUnits.find((unit) => unit.unitType === "listening_part");

  if (readingUnit && listeningUnit) {
    await prisma.assignment.create({
      data: {
        title: "Demo Reading and Listening Homework",
        instructions: "Complete the reading passage first, then answer the listening question.",
        mode: "homework",
        timeLimitMinutes: 30,
        teacherId: teacherProfile.id,
        units: {
          create: [
            {
              assignableUnitId: readingUnit.id,
              order: 1,
              customTimeLimitMinutes: 20
            },
            {
              assignableUnitId: listeningUnit.id,
              order: 2,
              customTimeLimitMinutes: 10
            }
          ]
        },
        recipients: {
          create: {
            studentId: studentProfile.id,
            status: "assigned"
          }
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
