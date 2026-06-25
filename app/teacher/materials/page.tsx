import type { Prisma } from "@prisma/client";
import { MaterialEditor } from "@/components/material-editor";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

const materialInclude = {
  units: {
    orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          questionType: true
        }
      },
      _count: {
        select: {
          questions: true
        }
      }
    }
  },
  _count: {
    select: {
      units: true
    }
  }
} satisfies Prisma.MaterialInclude;

type TeacherMaterial = Prisma.MaterialGetPayload<{
  include: typeof materialInclude;
}>;

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function TeacherMaterialsPage() {
  const teacher = await requireTeacher();
  const materials: TeacherMaterial[] = await prisma.material.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    include: materialInclude
  });

  const totalUnits = materials.reduce((sum, material) => sum + material._count.units, 0);
  const totalQuestions = materials.reduce(
    (sum, material) =>
      sum + material.units.reduce((unitSum, unit) => unitSum + unit._count.questions, 0),
    0
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Material bank</p>
          <h2 className="mt-2 text-3xl font-semibold">IELTS content library</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Build teacher-owned source materials, assignable units, and listening or reading
            questions.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md border border-border bg-muted/45 px-3 py-2">
            <p className="text-lg font-semibold">{materials.length}</p>
            <p className="text-xs text-muted-foreground">Materials</p>
          </div>
          <div className="rounded-md border border-border bg-muted/45 px-3 py-2">
            <p className="text-lg font-semibold">{totalUnits}</p>
            <p className="text-xs text-muted-foreground">Units</p>
          </div>
          <div className="rounded-md border border-border bg-muted/45 px-3 py-2">
            <p className="text-lg font-semibold">{totalQuestions}</p>
            <p className="text-xs text-muted-foreground">Questions</p>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        {materials.length > 0 ? (
          materials.map((material) => (
            <article key={material.id} className="rounded-md border border-border bg-muted/35">
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{material.title}</h3>
                      <span className="rounded-full border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary">
                        {formatValue(material.skill)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {[
                        material.sourceLabel,
                        countLabel(material._count.units, "unit"),
                        countLabel(
                          material.units.reduce((sum, unit) => sum + unit._count.questions, 0),
                          "question"
                        )
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {material.description ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {material.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border">
                {material.units.length > 0 ? (
                  material.units.map((unit) => (
                    <div
                      key={unit.id}
                      className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_10rem]"
                    >
                      <div>
                        <p className="font-medium">
                          {unit.unitNumber}. {unit.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatValue(unit.unitType)} · {countLabel(unit._count.questions, "question")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {unit.questions.slice(0, 3).map((question) => (
                          <span
                            key={question.id}
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                          >
                            Q{question.order} {formatValue(question.questionType)}
                          </span>
                        ))}
                        {unit.questions.length > 3 ? (
                          <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                            +{unit.questions.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    No units yet. Add the first unit below.
                  </p>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-border bg-muted/35 px-5 py-8">
            <p className="font-medium">No materials yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a material, then add assignable units and questions.
            </p>
          </div>
        )}
      </section>

      <MaterialEditor materials={materials} />
    </div>
  );
}
