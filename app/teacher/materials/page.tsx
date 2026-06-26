import type { Prisma } from "@prisma/client";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { MaterialEditor } from "@/components/material-editor";
import { requireTeacher } from "@/lib/actions/classes";
import {
  deleteMaterial,
  deleteQuestion,
  deleteUnit,
  updateMaterial,
  updateQuestion,
  updateUnit
} from "@/lib/actions/materials";
import { prisma } from "@/lib/prisma";

const materialInclude = {
  units: {
    orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    include: {
      questions: {
        orderBy: { order: "asc" }
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

const skillOptions = [
  { value: "listening", label: "Listening" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" }
];

const unitTypeOptions = [
  { value: "listening_part", label: "Listening part" },
  { value: "reading_passage", label: "Reading passage" },
  { value: "writing_task", label: "Writing task" },
  { value: "speaking_part", label: "Speaking part" }
];

const questionTypeOptions = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "short_answer", label: "Short answer" },
  { value: "matching", label: "Matching" },
  { value: "drag_drop_matching", label: "Drag/drop matching" },
  { value: "gap_fill", label: "Gap fill" },
  { value: "inline_gap_fill", label: "Inline gap fill" },
  { value: "table_completion", label: "Table completion" },
  { value: "true_false_not_given", label: "True / False / Not Given" }
];

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const compactFieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type TeacherMaterialsPageProps = {
  searchParams?: {
    materialsMessage?: string;
    materialsStatus?: string;
  };
};

export default async function TeacherMaterialsPage({ searchParams }: TeacherMaterialsPageProps) {
  const teacher = await requireTeacher();
  const materialsMessage = searchParams?.materialsMessage;
  const materialsStatus = searchParams?.materialsStatus === "success" ? "success" : "error";
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

      {materialsMessage ? (
        <div
          className={
            materialsStatus === "success"
              ? "rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
              : "rounded-md border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300"
          }
        >
          {materialsMessage}
        </div>
      ) : null}

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
                    <details className="mt-4 rounded-md border border-border bg-background/45 p-4">
                      <summary className="cursor-pointer text-sm font-semibold">Edit material</summary>
                      <form action={updateMaterial} className="mt-4 grid gap-3">
                        <input type="hidden" name="materialId" value={material.id} />
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                          <div>
                            <label className="text-sm font-medium" htmlFor={`material-title-${material.id}`}>
                              Title
                            </label>
                            <input
                              id={`material-title-${material.id}`}
                              name="title"
                              minLength={2}
                              required
                              defaultValue={material.title}
                              className={fieldClass}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium" htmlFor={`material-skill-${material.id}`}>
                              Skill
                            </label>
                            <select
                              id={`material-skill-${material.id}`}
                              name="skill"
                              required
                              defaultValue={material.skill}
                              className={fieldClass}
                            >
                              {skillOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="text-sm font-medium" htmlFor={`material-source-${material.id}`}>
                              Source
                            </label>
                            <input
                              id={`material-source-${material.id}`}
                              name="sourceLabel"
                              defaultValue={material.sourceLabel ?? ""}
                              className={fieldClass}
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium" htmlFor={`material-description-${material.id}`}>
                              Description
                            </label>
                            <textarea
                              id={`material-description-${material.id}`}
                              name="description"
                              rows={2}
                              defaultValue={material.description ?? ""}
                              className={fieldClass}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className={secondaryButtonClass}>Save material</button>
                          <ConfirmSubmitButton
                            formAction={deleteMaterial}
                            confirmMessage={`Delete material "${material.title}" and all its units and questions? This cannot be undone.`}
                            className={dangerButtonClass}
                          >
                            Delete material
                          </ConfirmSubmitButton>
                        </div>
                      </form>
                    </details>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border">
                {material.units.length > 0 ? (
                  material.units.map((unit) => (
                    <div key={unit.id} className="px-5 py-4">
                      <div>
                        <p className="font-medium">
                          {unit.unitNumber}. {unit.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatValue(unit.unitType)} · {countLabel(unit._count.questions, "question")}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
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
                      <details className="mt-3 rounded-md border border-border bg-background/45 p-4">
                        <summary className="cursor-pointer text-sm font-semibold">Edit unit</summary>
                        <form action={updateUnit} className="mt-4 grid gap-3">
                          <input type="hidden" name="unitId" value={unit.id} />
                          <input type="hidden" name="materialId" value={material.id} />
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_6rem]">
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-title-${unit.id}`}>
                                Title
                              </label>
                              <input
                                id={`unit-title-${unit.id}`}
                                name="title"
                                minLength={2}
                                required
                                defaultValue={unit.title}
                                className={fieldClass}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-type-${unit.id}`}>
                                Unit type
                              </label>
                              <select
                                id={`unit-type-${unit.id}`}
                                name="unitType"
                                required
                                defaultValue={unit.unitType}
                                className={fieldClass}
                              >
                                {unitTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-number-${unit.id}`}>
                                Number
                              </label>
                              <input
                                id={`unit-number-${unit.id}`}
                                name="unitNumber"
                                type="number"
                                min={1}
                                required
                                defaultValue={unit.unitNumber}
                                className={fieldClass}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-instructions-${unit.id}`}>
                                Instructions
                              </label>
                              <textarea
                                id={`unit-instructions-${unit.id}`}
                                name="instructions"
                                rows={3}
                                defaultValue={unit.instructions ?? ""}
                                className={fieldClass}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-content-${unit.id}`}>
                                Content
                              </label>
                              <textarea
                                id={`unit-content-${unit.id}`}
                                name="content"
                                rows={5}
                                required
                                defaultValue={unit.content}
                                className={fieldClass}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-audio-${unit.id}`}>
                                Audio URL
                              </label>
                              <input
                                id={`unit-audio-${unit.id}`}
                                name="audioUrl"
                                type="url"
                                defaultValue={unit.audioUrl ?? ""}
                                className={fieldClass}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-time-${unit.id}`}>
                                Time limit
                              </label>
                              <input
                                id={`unit-time-${unit.id}`}
                                name="defaultTimeLimitMinutes"
                                type="number"
                                min={1}
                                defaultValue={unit.defaultTimeLimitMinutes ?? ""}
                                className={fieldClass}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-transcript-${unit.id}`}>
                                Transcript
                              </label>
                              <textarea
                                id={`unit-transcript-${unit.id}`}
                                name="transcript"
                                rows={3}
                                defaultValue={unit.transcript ?? ""}
                                className={fieldClass}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-metadata-${unit.id}`}>
                                Metadata JSON
                              </label>
                              <textarea
                                id={`unit-metadata-${unit.id}`}
                                name="metadataJson"
                                rows={3}
                                defaultValue={unit.metadataJson ?? ""}
                                className={fieldClass}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className={secondaryButtonClass}>Save unit</button>
                            <ConfirmSubmitButton
                              formAction={deleteUnit}
                              confirmMessage={`Delete unit "${unit.title}" and all its questions? This cannot be undone.`}
                              className={dangerButtonClass}
                            >
                              Delete unit
                            </ConfirmSubmitButton>
                          </div>
                        </form>
                      </details>
                      {unit.questions.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {unit.questions.map((question) => (
                            <details
                              key={question.id}
                              className="rounded-md border border-border bg-background/45 p-4"
                            >
                              <summary className="cursor-pointer text-sm font-semibold">
                                Edit Q{question.order} {formatValue(question.questionType)}
                              </summary>
                              <form action={updateQuestion} className="mt-4 grid gap-3">
                                <input type="hidden" name="questionId" value={question.id} />
                                <input type="hidden" name="assignableUnitId" value={unit.id} />
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_5rem_5rem]">
                                  <div>
                                    <label className="text-sm font-medium" htmlFor={`question-type-${question.id}`}>
                                      Type
                                    </label>
                                    <select
                                      id={`question-type-${question.id}`}
                                      name="questionType"
                                      required
                                      defaultValue={question.questionType}
                                      className={fieldClass}
                                    >
                                      {questionTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium" htmlFor={`question-order-${question.id}`}>
                                      Order
                                    </label>
                                    <input
                                      id={`question-order-${question.id}`}
                                      name="order"
                                      type="number"
                                      min={1}
                                      required
                                      defaultValue={question.order}
                                      className={fieldClass}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium" htmlFor={`question-points-${question.id}`}>
                                      Points
                                    </label>
                                    <input
                                      id={`question-points-${question.id}`}
                                      name="points"
                                      type="number"
                                      min={1}
                                      required
                                      defaultValue={question.points}
                                      className={fieldClass}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium" htmlFor={`question-prompt-${question.id}`}>
                                    Prompt
                                  </label>
                                  <textarea
                                    id={`question-prompt-${question.id}`}
                                    name="prompt"
                                    rows={3}
                                    required
                                    defaultValue={question.prompt}
                                    className={fieldClass}
                                  />
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="text-sm font-medium" htmlFor={`question-options-${question.id}`}>
                                      Options JSON
                                    </label>
                                    <textarea
                                      id={`question-options-${question.id}`}
                                      name="optionsJson"
                                      rows={3}
                                      defaultValue={question.optionsJson ?? ""}
                                      className={compactFieldClass}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium" htmlFor={`question-answer-${question.id}`}>
                                      Answer JSON
                                    </label>
                                    <textarea
                                      id={`question-answer-${question.id}`}
                                      name="correctAnswerJson"
                                      rows={3}
                                      defaultValue={question.correctAnswerJson ?? ""}
                                      className={compactFieldClass}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium" htmlFor={`question-explanation-${question.id}`}>
                                    Explanation
                                  </label>
                                  <textarea
                                    id={`question-explanation-${question.id}`}
                                    name="explanation"
                                    rows={2}
                                    defaultValue={question.explanation ?? ""}
                                    className={fieldClass}
                                  />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button className={secondaryButtonClass}>Save question</button>
                                  <ConfirmSubmitButton
                                    formAction={deleteQuestion}
                                    confirmMessage={`Delete question Q${question.order}? This cannot be undone.`}
                                    className={dangerButtonClass}
                                  >
                                    Delete question
                                  </ConfirmSubmitButton>
                                </div>
                              </form>
                            </details>
                          ))}
                        </div>
                      ) : null}
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
