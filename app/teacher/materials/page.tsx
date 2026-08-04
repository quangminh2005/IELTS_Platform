import type { Prisma } from "@prisma/client";
import { requireTeacherPage } from "@/lib/teacher-page";
import Link from "next/link";
import { ActionDeleteButton, ActionForm, ActionSubmitButton } from "@/components/action-form";
import { MaterialUnitsPanel } from "@/components/material-units-panel";
import { MaterialsBrowser, type MaterialBrowserItem } from "@/components/materials-browser";
import {
  deleteMaterial,
  deleteQuestion,
  deleteUnit,
  setPracticeOpen,
  updateMaterial,
  updateQuestion,
  updateUnit
} from "@/lib/actions/materials";
import {
  computeStatus,
  deriveSeries,
  type MaterialStatusFlags
} from "@/lib/materials-filter";
import { prisma } from "@/lib/prisma";

// Query nhẹ: trang danh sách chỉ cần đủ dữ liệu để vẽ thẻ + tính cờ trạng thái.
// Không nạp content/transcript/metadata hay các bản ghi câu hỏi — những thứ đó chỉ
// tải khi giáo viên bấm mở "Xem N phần" (xem MaterialUnitsPanel + API detail route).
const materialSelect = {
  id: true,
  title: true,
  skill: true,
  sourceLabel: true,
  practiceOpen: true,
  description: true,
  createdAt: true,
  units: {
    orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      audioUrl: true,
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
} satisfies Prisma.MaterialSelect;

type TeacherMaterial = Prisma.MaterialGetPayload<{
  select: typeof materialSelect;
}>;

const skillOptions = [
  { value: "listening", label: "Listening" },
  { value: "reading", label: "Reading" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" }
];

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

const secondaryButtonClass =
  "rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary";

const dangerButtonClass =
  "rounded-md border border-red-400/60 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/15 dark:text-red-300";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function formatValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const amberTagClass =
  "rounded-full border border-amber-400/50 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300";

function StatusTags({ status }: { status: MaterialStatusFlags }) {
  return (
    <>
      {status.isEmpty ? (
        <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          Chưa có phần
        </span>
      ) : null}
      {status.missingAudio ? <span className={amberTagClass}>Thiếu audio</span> : null}
      {status.missingQuestions ? <span className={amberTagClass}>Thiếu câu hỏi</span> : null}
      {status.isComplete ? (
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Đã hoàn chỉnh
        </span>
      ) : null}
    </>
  );
}

type TeacherMaterialsPageProps = {
  searchParams?: {
    materialsMessage?: string;
    materialsStatus?: string;
  };
};

export default async function TeacherMaterialsPage({ searchParams }: TeacherMaterialsPageProps) {
  const teacher = await requireTeacherPage();
  const materialsMessage = searchParams?.materialsMessage;
  const materialsStatus = searchParams?.materialsStatus === "success" ? "success" : "error";
  // Hai truy vấn chỉ cần teacher.id, không phụ thuộc nhau -> chạy song song.
  const [materials, assignmentUnits] = await Promise.all([
    prisma.material.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      select: materialSelect
    }) as Promise<TeacherMaterial[]>,
    // Ngày "giao gần nhất" mỗi tài liệu — dùng cho sắp xếp "Giao gần đây".
    prisma.assignmentUnit.findMany({
      where: { assignment: { teacherId: teacher.id } },
      select: {
        assignableUnit: { select: { materialId: true } },
        assignment: { select: { createdAt: true } }
      }
    })
  ]);

  const totalUnits = materials.reduce((sum, material) => sum + material._count.units, 0);
  const totalQuestions = materials.reduce(
    (sum, material) =>
      sum + material.units.reduce((unitSum, unit) => unitSum + unit._count.questions, 0),
    0
  );
  const lastAssignedByMaterial = new Map<string, number>();
  for (const link of assignmentUnits) {
    const materialId = link.assignableUnit.materialId;
    const assignedAt = link.assignment.createdAt.getTime();
    const current = lastAssignedByMaterial.get(materialId);
    if (current === undefined || assignedAt > current) {
      lastAssignedByMaterial.set(materialId, assignedAt);
    }
  }

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
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
          <Link
            href="/teacher/materials/create"
            className="inline-flex h-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            <span className="text-base leading-none">+</span> Tạo / Nhập tài liệu
          </Link>
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
          <MaterialsBrowser
            items={materials.map((material): MaterialBrowserItem => {
              const materialQuestions = material.units.reduce(
                (sum, unit) => sum + unit._count.questions,
                0
              );
              const status = computeStatus(
                material.skill,
                material.units.map((unit) => ({
                  hasAudio: Boolean(unit.audioUrl),
                  questionCount: unit._count.questions
                }))
              );
              const meta = {
                id: material.id,
                title: material.title,
                skill: material.skill,
                series: deriveSeries(material.sourceLabel, material.title),
                unitCount: material._count.units,
                questionCount: materialQuestions,
                createdAtMs: material.createdAt.getTime(),
                lastAssignedAtMs: lastAssignedByMaterial.get(material.id) ?? null,
                status,
                searchText: `${material.title} ${material.sourceLabel ?? ""}`.toLowerCase(),
                practiceOpen: material.practiceOpen
              };
              return {
                meta,
                card: (
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
                      <StatusTags status={status} />
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
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {material._count.units > 0 ? (
                        <Link
                          href={`/teacher/materials/${material.id}/preview`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
                        >
                          <EyeIcon className="size-4" />
                          Xem trước (làm thử)
                        </Link>
                      ) : null}
                      <ActionForm action={setPracticeOpen}>
                        <input type="hidden" name="materialId" value={material.id} />
                        <input
                          type="hidden"
                          name="practiceOpen"
                          value={material.practiceOpen ? "0" : "1"}
                        />
                        <ActionSubmitButton
                          className={
                            material.practiceOpen
                              ? "rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
                              : secondaryButtonClass
                          }
                        >
                          {material.practiceOpen ? "Đang cho tự luyện" : "Cho tự luyện"}
                        </ActionSubmitButton>
                      </ActionForm>
                    </div>
                    <details className="mt-4 rounded-lg border border-border bg-muted/60 p-4 transition-colors hover:border-primary/40 hover:bg-muted">
                      <summary className="cursor-pointer text-sm font-semibold">
                        <PencilIcon className="mr-1.5 -mt-0.5 inline-block size-4 align-middle text-muted-foreground" />
                        Sửa tài liệu
                      </summary>
                      <ActionForm action={updateMaterial} className="mt-4 grid gap-3">
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
                          <ActionSubmitButton className={secondaryButtonClass}>
                            Lưu tài liệu
                          </ActionSubmitButton>
                          <ActionDeleteButton
                            action={deleteMaterial}
                            confirmMessage={`Xoá tài liệu "${material.title}"?\n\nSẽ xoá toàn bộ phần, câu hỏi VÀ CẢ BÀI LÀM/ĐÁP ÁN của học sinh thuộc tài liệu này. Các bài tập đã giao có dùng tài liệu này sẽ bị gỡ phần đó. KHÔNG THỂ HOÀN TÁC.`}
                            className={dangerButtonClass}
                          >
                            Xoá tài liệu
                          </ActionDeleteButton>
                        </div>
                      </ActionForm>
                    </details>
                  </div>
                </div>
              </div>

              {material._count.units > 0 ? (
                <MaterialUnitsPanel
                  materialId={material.id}
                  unitCount={material._count.units}
                  questionCount={materialQuestions}
                  updateUnit={updateUnit}
                  deleteUnit={deleteUnit}
                  updateQuestion={updateQuestion}
                  deleteQuestion={deleteQuestion}
                />
              ) : (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  Chưa có phần nào. Bấm{" "}
                  <Link href="/teacher/materials/create" className="font-semibold text-primary hover:underline">
                    Tạo / Nhập tài liệu
                  </Link>{" "}
                  để thêm phần.
                </p>
              )}
            </article>
                )
              };
            })}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center shadow-card">
            <p className="font-semibold">Chưa có tài liệu nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo tài liệu, sau đó thêm các phần và câu hỏi có thể giao.
            </p>
            <Link
              href="/teacher/materials/create"
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
            >
              <span className="text-base leading-none">+</span> Tạo / Nhập tài liệu
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
