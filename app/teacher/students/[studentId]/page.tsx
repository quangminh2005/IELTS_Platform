import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

type StudentPageProps = {
  params: {
    studentId: string;
  };
};

function formatDate(value: Date | null) {
  if (!value) {
    return "Not submitted";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

export default async function TeacherStudentPage({ params }: StudentPageProps) {
  const teacher = await requireTeacher();
  const student = await prisma.studentProfile.findFirst({
    where: {
      id: params.studentId,
      classes: {
        some: {
          class: {
            teacherId: teacher.id
          }
        }
      }
    },
    include: {
      classes: {
        where: {
          class: {
            teacherId: teacher.id
          }
        },
        include: {
          class: true
        },
        orderBy: {
          joinedAt: "desc"
        }
      },
      recipients: {
        where: {
          assignment: {
            teacherId: teacher.id
          }
        },
        include: {
          assignment: true,
          attempts: {
            orderBy: {
              startedAt: "desc"
            }
          }
        },
        orderBy: {
          id: "desc"
        }
      }
    }
  });

  if (!student) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/teacher/classes" className="text-sm font-medium text-primary">
            Back to classes
          </Link>
          <h2 className="mt-3 text-3xl font-semibold">{student.displayName}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{student.email}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/45 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Classes</p>
          <p className="mt-1 text-xl font-semibold">{student.classes.length}</p>
        </div>
      </header>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Class memberships</h3>
        </div>
        <div className="divide-y divide-border">
          {student.classes.map((membership: (typeof student.classes)[number]) => (
            <div key={membership.id} className="px-5 py-4">
              <p className="font-medium">{membership.class.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Joined {formatDate(membership.joinedAt)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-muted/35">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">Assignments and attempts</h3>
        </div>
        <div className="divide-y divide-border">
          {student.recipients.length > 0 ? (
            student.recipients.map((recipient: (typeof student.recipients)[number]) => (
              <article key={recipient.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{recipient.assignment.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Status: {recipient.status}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{recipient.attempts.length} attempts</p>
                </div>
                {recipient.attempts.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {recipient.attempts.map((attempt: (typeof recipient.attempts)[number]) => (
                      <div key={attempt.id} className="rounded-md border border-border bg-background/70 p-3">
                        <p className="text-sm font-medium">
                          Attempt status: {attempt.status}
                          {typeof attempt.scorePercent === "number"
                            ? ` - ${attempt.scorePercent.toFixed(1)}%`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Started {formatDate(attempt.startedAt)} - {attempt.elapsedSeconds}s elapsed -{" "}
                          {attempt.tabSwitchCount} tab switches
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No attempts recorded yet.</p>
                )}
              </article>
            ))
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No assignment recipients found for this student yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
