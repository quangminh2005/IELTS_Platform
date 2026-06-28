import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Tải ảnh "qua server" cho đề bài (biểu đồ Writing Task 1, bản đồ, bảng số liệu...).
// Trình duyệt POST file tới đây, server đẩy lên Vercel Blob bằng
// BLOB_READ_WRITE_TOKEN. Giới hạn body serverless ~4.5MB — ảnh đề thường nhẹ hơn.
const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml"
]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Teacher access required." }, { status: 403 });
  }

  let file: FormDataEntryValue | null;

  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return NextResponse.json(
      { error: "Ảnh quá lớn để tải thẳng (giới hạn ~4.5MB). Hãy nén ảnh nhẹ hơn hoặc dán link ảnh." },
      { status: 413 }
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Không nhận được file." }, { status: 400 });
  }

  if (file.type && !allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Định dạng ảnh không hỗ trợ (chỉ PNG, JPG, WEBP, GIF, SVG)." },
      { status: 400 }
    );
  }

  try {
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "image/png"
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
