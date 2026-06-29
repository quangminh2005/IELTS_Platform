import type { Prisma } from "@prisma/client";
import { AudioUpload } from "@/components/audio-upload";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ImageUpload } from "@/components/image-upload";
import { MaterialEditor } from "@/components/material-editor";
import { MaterialImport } from "@/components/material-import";
import { QuestionFields } from "@/components/question-fields";
import { requireTeacher } from "@/lib/actions/classes";
import { parseUnitImages } from "@/lib/question-interactions";
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

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

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
          <p className="text-sm font-semibold text-primary">Kho tài liệu</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Thư viện nội dung IELTS</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tạo tài liệu nguồn, các phần có thể giao và câu hỏi Listening hay Reading.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-card">
            <p className="text-lg font-bold tabular-nums">{materials.length}</p>
            <p className="text-xs text-muted-foreground">Tài liệu</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-card">
            <p className="text-lg font-bold tabular-nums">{totalUnits}</p>
            <p className="text-xs text-muted-foreground">Phần</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-card">
            <p className="text-lg font-bold tabular-nums">{totalQuestions}</p>
            <p className="text-xs text-muted-foreground">Câu hỏi</p>
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
          materials.map((material) => {
            const materialQuestions = material.units.reduce(
              (sum, unit) => sum + unit._count.questions,
              0
            );
            return (
            <article
              key={material.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{material.title}</h3>
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {formatValue(material.skill)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {[
                        material.sourceLabel,
                        `${material._count.units} phần`,
                        `${materialQuestions} câu hỏi`
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {material.description ? (
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {material.description}
                      </p>
                    ) : null}
                    <details className="mt-4 rounded-lg border border-border bg-muted/60 p-4">
                      <summary className="cursor-pointer text-sm font-semibold">Sửa tài liệu</summary>
                      <form action={updateMaterial} className="mt-4 grid gap-3">
                        <input type="hidden" name="materialId" value={material.id} />
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                          <div>
                            <label className="text-sm font-medium" htmlFor={`material-title-${material.id}`}>
                              Tiêu đề
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
                              Kỹ năng
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
                              Nguồn
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
                              Mô tả
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
                          <button className={secondaryButtonClass}>Lưu tài liệu</button>
                          <ConfirmSubmitButton
                            formAction={deleteMaterial}
                            confirmMessage={`Xoá tài liệu "${material.title}" cùng toàn bộ phần và câu hỏi? Không thể hoàn tác.`}
                            className={dangerButtonClass}
                          >
                            Xoá tài liệu
                          </ConfirmSubmitButton>
                        </div>
                      </form>
                    </details>
                  </div>
                </div>
              </div>

              {material.units.length > 0 ? (
                <details>
                  <summary className="cursor-pointer px-5 py-3 text-sm font-semibold hover:bg-muted/40">
                    Xem {material._count.units} phần · {materialQuestions} câu hỏi
                  </summary>
                  <div className="divide-y divide-border border-t border-border">
                    {material.units.map((unit) => (
                    <div key={unit.id} className="px-5 py-4">
                      <div>
                        <p className="font-medium">
                          {unit.unitNumber}. {unit.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatValue(unit.unitType)} · {unit._count.questions} câu hỏi
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
                      <details className="mt-3 rounded-lg border border-border bg-muted/60 p-4">
                        <summary className="cursor-pointer text-sm font-semibold">Sửa phần</summary>
                        <form action={updateUnit} className="mt-4 grid gap-3">
                          <input type="hidden" name="unitId" value={unit.id} />
                          <input type="hidden" name="materialId" value={material.id} />
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_6rem]">
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-title-${unit.id}`}>
                                Tiêu đề
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
                                Loại phần
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
                                Số thứ tự
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
                                Hướng dẫn
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
                                Nội dung
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
                                Âm thanh
                              </label>
                              <AudioUpload
                                id={`unit-audio-${unit.id}`}
                                defaultValue={unit.audioUrl ?? ""}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-time-${unit.id}`}>
                                Thời gian (phút)
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
                          <div>
                            <label className="text-sm font-medium" htmlFor={`unit-image-${unit.id}`}>
                              Hình ảnh (biểu đồ/bản đồ Writing Task 1, ...)
                            </label>
                            <div className="mt-2">
                              <ImageUpload
                                id={`unit-image-${unit.id}`}
                                defaultValue={parseUnitImages(unit.metadataJson)}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-sm font-medium" htmlFor={`unit-transcript-${unit.id}`}>
                                Lời thoại (transcript)
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
                                Metadata (JSON)
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
                            <button className={secondaryButtonClass}>Lưu phần</button>
                            <ConfirmSubmitButton
                              formAction={deleteUnit}
                              confirmMessage={`Xoá phần "${unit.title}" cùng toàn bộ câu hỏi? Không thể hoàn tác.`}
                              className={dangerButtonClass}
                            >
                              Xoá phần
                            </ConfirmSubmitButton>
                          </div>
                        </form>
                      </details>
                      {unit.questions.length > 0 ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                            Danh sách câu hỏi ({unit.questions.length})
                          </summary>
                          <div className="mt-3 space-y-3">
                          {unit.questions.map((question) => (
                            <details
                              key={question.id}
                              className="rounded-md border border-border bg-background/45 p-4"
                            >
                              <summary className="cursor-pointer text-sm font-semibold">
                                Sửa câu {question.order} · {formatValue(question.questionType)}
                              </summary>
                              <QuestionFields
                                formAction={updateQuestion}
                                submitLabel="Lưu câu hỏi"
                                idPrefix={`edit-${question.id}`}
                                selectedUnitId={unit.id}
                                hiddenFields={{ questionId: question.id }}
                                defaults={{
                                  questionType: question.questionType,
                                  order: question.order,
                                  points: question.points,
                                  prompt: question.prompt,
                                  optionsJson: question.optionsJson,
                                  correctAnswerJson: question.correctAnswerJson,
                                  explanation: question.explanation
                                }}
                                deleteAction={deleteQuestion}
                                deleteConfirm={`Xoá câu ${question.order}? Không thể hoàn tác.`}
                              />
                            </details>
                          ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                    ))}
                  </div>
                </details>
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Chưa có phần nào. Thêm phần đầu tiên ở bên dưới.
                </p>
              )}
            </article>
            );
          })
        ) : (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
            <p className="font-semibold">Chưa có tài liệu nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo tài liệu, sau đó thêm các phần và câu hỏi có thể giao.
            </p>
          </div>
        )}
      </section>

      <MaterialImport />

      <MaterialEditor materials={materials} />
    </div>
  );
}
