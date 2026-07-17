import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Chi tiết một tài liệu (các phần + câu hỏi) — tải theo yêu cầu khi giáo viên bấm
// mở "Xem N phần" ở Kho tài liệu. Trang danh sách chỉ tải phần nhẹ; toàn bộ nội
// dung nặng (content/transcript/metadata + 970 câu hỏi) chỉ nạp khi thật sự mở ra.
export async function GET(
  _request: Request,
  { params }: { params: { materialId: string } }
): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  // Chốt quyền: chỉ trả về tài liệu thuộc đúng giáo viên đang đăng nhập.
  const material = await prisma.material.findFirst({
    where: { id: params.materialId, teacher: { userId: session.user.id } },
    select: {
      id: true,
      units: {
        orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          unitNumber: true,
          title: true,
          unitType: true,
          instructions: true,
          content: true,
          audioUrl: true,
          transcript: true,
          defaultTimeLimitMinutes: true,
          metadataJson: true,
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              questionType: true,
              points: true,
              prompt: true,
              optionsJson: true,
              correctAnswerJson: true,
              explanation: true,
              answerEvidence: true
            }
          }
        }
      }
    }
  });

  if (!material) {
    return NextResponse.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
  }

  return NextResponse.json({ units: material.units });
}
