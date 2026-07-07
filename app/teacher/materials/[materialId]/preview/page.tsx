import { notFound } from "next/navigation";
import { AttemptWorkspace } from "@/components/attempt-workspace";
import { requireTeacher } from "@/lib/actions/classes";
import { detectMultiSelectGroups } from "@/lib/multi-select";
import { parseQuestionOptions } from "@/lib/question-interactions";
import { prisma } from "@/lib/prisma";

type MaterialPreviewPageProps = {
  params: {
    materialId: string;
  };
};

// Xem trước giao diện làm bài (chế độ giáo viên). Dựng thẳng "đề" từ Material —
// KHÔNG tạo assignment/attempt/học sinh nào trong DB. AttemptWorkspace chạy ở
// previewMode: không lưu nháp, không ghi highlight, nút nộp chỉ đóng lại.
export default async function MaterialPreviewPage({ params }: MaterialPreviewPageProps) {
  const teacher = await requireTeacher();

  // Chỉ cho xem trước tài liệu của chính giáo viên đang đăng nhập.
  const material = await prisma.material.findFirst({
    where: {
      id: params.materialId,
      teacherId: teacher.id
    },
    include: {
      units: {
        orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
        include: {
          questions: {
            orderBy: { order: "asc" }
          }
        }
      }
    }
  });

  if (!material) {
    notFound();
  }

  // Ghép dữ liệu Material vào đúng hình dạng mà AttemptWorkspace mong đợi
  // (assignment.units[].assignableUnit). unitNumber đóng vai "order" của phần.
  const assignment = {
    title: `Xem trước · ${material.title}`,
    instructions: material.description,
    timeLimitMinutes: null,
    units: material.units.map((unit) => ({
      id: unit.id,
      order: unit.unitNumber,
      customTimeLimitMinutes: null,
      assignableUnit: {
        id: unit.id,
        skill: unit.skill,
        unitType: unit.unitType,
        title: unit.title,
        instructions: unit.instructions,
        content: unit.content,
        audioUrl: unit.audioUrl,
        transcript: unit.transcript,
        defaultTimeLimitMinutes: unit.defaultTimeLimitMinutes,
        metadataJson: unit.metadataJson,
        questions: unit.questions.map((question) => ({
          id: question.id,
          order: question.order,
          questionType: question.questionType,
          prompt: question.prompt,
          optionsJson: question.optionsJson
        }))
      }
    }))
  };

  // Nhận diện nhóm "Choose N" giống trang làm bài của học sinh.
  const multiSelectGroups = material.units.flatMap((unit) =>
    detectMultiSelectGroups(
      unit.questions.map((question) => ({
        id: question.id,
        questionType: question.questionType,
        options: parseQuestionOptions(question.optionsJson),
        correctAnswers: parseQuestionOptions(question.correctAnswerJson)
      }))
    )
  );

  return (
    <AttemptWorkspace
      previewMode
      recipientId="preview"
      attempt={{ id: "preview", startedAt: new Date(), elapsedSeconds: 0 }}
      assignment={assignment}
      highlights={[]}
      savedAnswers={{}}
      multiSelectGroups={multiSelectGroups}
    />
  );
}
