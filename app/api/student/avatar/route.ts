import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Nhận ảnh đại diện đã được TRÌNH DUYỆT cắt vuông + thu về 256px webp
// (components/profile-editor.tsx). Ảnh tới đây chỉ khoảng 20KB.
//
// Không dùng lại /api/image/direct-upload: route đó dành cho ảnh đề bài và khoá
// cứng vai trò giáo viên. Mở nó cho học viên là nới một cửa rộng hơn mức cần thiết.
const MAX_BYTES = 512 * 1024;

// Cố tình KHÔNG nhận SVG: định dạng đó chứa được script, ảnh đại diện không cần tới.
const allowedTypes = new Set(["image/webp", "image/png", "image/jpeg"]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const role = session?.user?.role;

  if (!session?.user?.id || (role !== "teacher" && role !== "student")) {
    return NextResponse.json({ error: "Cần đăng nhập." }, { status: 403 });
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ảnh quá lớn. Hãy chọn ảnh khác." },
      { status: 413 }
    );
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Định dạng ảnh không hỗ trợ (chỉ PNG, JPG, WEBP)." },
      { status: 400 }
    );
  }

  try {
    const blob = await put(`avatars/${session.user.id}.webp`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
