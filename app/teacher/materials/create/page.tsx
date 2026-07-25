import Link from "next/link";
import { requireTeacherPage } from "@/lib/teacher-page";
import { MaterialEditor } from "@/components/material-editor";
import { MaterialImport } from "@/components/material-import";
import { prisma } from "@/lib/prisma";

export default async function CreateMaterialPage() {
  const teacher = await requireTeacherPage();
  const materials = await prisma.material.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      skill: true,
      title: true,
      units: {
        orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          skill: true,
          unitType: true,
          unitNumber: true,
          title: true,
          questions: {
            orderBy: { order: "asc" },
            select: { id: true, order: true, questionType: true }
          }
        }
      }
    }
  });

  return (
    <div className="space-y-8">
      <Link
        href="/teacher/materials"
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary transition hover:border-primary"
      >
        ← Về kho tài liệu
      </Link>

      <header>
        <p className="text-sm font-semibold text-primary">Kho tài liệu</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Tạo / Nhập tài liệu
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Dán cả đề bằng JSON để tạo nhanh, hoặc tạo từng tài liệu, phần và câu hỏi bằng
          biểu mẫu bên dưới. Sau khi tạo xong sẽ quay lại kho tài liệu.
        </p>
      </header>

      <MaterialImport />

      <MaterialEditor materials={materials} />
    </div>
  );
}
