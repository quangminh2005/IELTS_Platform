import { AssignmentCalendar } from "@/components/assignment-calendar";
import { requireTeacher } from "@/lib/actions/classes";
import {
  buildSkillProgress,
  countGradedAnswers,
  type CalendarAssignment,
  type CalendarClass
} from "@/lib/assignment-calendar";
import { attemptBand } from "@/lib/band-score";
import { orderedSkillsOfAssignment } from "@/lib/skill-sessions";
import { prisma } from "@/lib/prisma";

export default async function TeacherCalendarPage() {
  const teacher = await requireTeacher();

  const [classes, assignments] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: {
        students: {
          include: { student: { select: { id: true } } }
        }
      }
    }),
    prisma.assignment.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { units: true } },
        // Kỹ năng của bài (để biết học viên còn thiếu phần nào khi đang làm dở).
        units: { select: { assignableUnit: { select: { skill: true } } } },
        recipients: {
          include: {
            student: { select: { id: true, displayName: true, email: true } },
            attempts: {
              orderBy: { startedAt: "desc" },
              take: 1,
              include: {
                review: { select: { overallBand: true } },
                skills: { select: { skill: true, status: true } },
                answers: {
                  select: {
                    isCorrect: true,
                    assignableUnit: { select: { skill: true } }
                  }
                }
              }
            }
          }
        }
      }
    })
  ]);

  const classIdsByStudent = new Map<string, string[]>();
  for (const cls of classes) {
    for (const membership of cls.students) {
      const list = classIdsByStudent.get(membership.student.id) ?? [];
      list.push(cls.id);
      classIdsByStudent.set(membership.student.id, list);
    }
  }

  const calendarClasses: CalendarClass[] = classes.map((cls) => ({
    id: cls.id,
    name: cls.name
  }));

  const calendarAssignments: CalendarAssignment[] = assignments.map((assignment) => {
    const assignmentSkills = orderedSkillsOfAssignment(assignment.units);

    return {
      id: assignment.id,
      title: assignment.title,
      createdAt: assignment.createdAt.toISOString(),
      deadline: assignment.deadline ? assignment.deadline.toISOString() : null,
      unitCount: assignment._count.units,
      recipients: assignment.recipients.map((recipient) => {
        const attempt = recipient.attempts[0] ?? null;

        if (!attempt) {
          return {
            studentId: recipient.student.id,
            displayName: recipient.student.displayName,
            email: recipient.student.email,
            classIds: classIdsByStudent.get(recipient.student.id) ?? [],
            status: recipient.status,
            attempt: null
          };
        }

        const answers = attempt.answers.map((answer) => ({
          isCorrect: answer.isCorrect,
          skill: answer.assignableUnit.skill
        }));
        const { correct, total } = countGradedAnswers(answers);

        return {
          studentId: recipient.student.id,
          displayName: recipient.student.displayName,
          email: recipient.student.email,
          classIds: classIdsByStudent.get(recipient.student.id) ?? [],
          status: recipient.status,
          attempt: {
            id: attempt.id,
            status: attempt.status,
            submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
            elapsedSeconds: attempt.elapsedSeconds,
            tabSwitchCount: attempt.tabSwitchCount,
            findAttemptCount: attempt.findAttemptCount,
            band: attemptBand(attempt.review?.overallBand ?? null, answers),
            correct,
            total,
            scorePercent: attempt.scorePercent,
            hasPendingManual: answers.some((answer) => answer.isCorrect === null),
            skills: buildSkillProgress(assignmentSkills, attempt.skills, answers)
          }
        };
      })
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold text-primary">Theo dõi bài tập</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lịch giao bài</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Xem lại các bài đã giao theo ngày và theo lớp. Bấm vào một bài để biết ai đã nộp, đúng
          hay trễ hạn, làm trong bao lâu và kết quả ra sao.
        </p>
      </header>

      <AssignmentCalendar assignments={calendarAssignments} classes={calendarClasses} />
    </div>
  );
}
