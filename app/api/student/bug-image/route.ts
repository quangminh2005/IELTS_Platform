import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BUG_IMAGE_MAX_BYTES } from "@/lib/bug-report";

export const runtime = "nodejs";

// Ảnh chụp màn hình kèm báo lỗi. Trình duyệt đã thu nhỏ (cạnh dài 1280px, webp/
// jpeg) trước khi gửi — components/bug-report-dialog.tsx — nên ảnh tới đây chỉ vài
// trăm KB. Không dùng lại /api/image/direct-upload (khoá cứng vai trò giáo viên,
// nhận cả SVG). Không nhận SVG: chứa được script, ảnh chụp màn hình không cần.
const allowedTypes = new Map<string, string>([
  ["image/webp", "webp"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"]
]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    return NextResponse.json({ error: "Cần đăng nhập học viên." }, { status: 403 });
  }

  let file: FormDataEntryValue | null;

  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return NextResponse.json({ error: "Ảnh quá lớn." }, { status: 413 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Không nhận được ảnh." }, { status: 400 });
  }

  if (file.size > BUG_IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh quá lớn (tối đa 1MB)." }, { status: 413 });
  }

  const extension = allowedTypes.get(file.type);
  if (!extension) {
    return NextResponse.json(
      { error: "Định dạng ảnh không hỗ trợ (chỉ PNG, JPG, WEBP)." },
      { status: 400 }
    );
  }

  try {
    const blob = await put(`bug-reports/${session.user.id}-${Date.now()}.${extension}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
