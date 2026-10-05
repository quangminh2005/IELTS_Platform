import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Nhận ảnh nền bìa hồ sơ đã được TRÌNH DUYỆT thu về cạnh dài 1600px + nén webp/jpeg
// (lib/image-shrink.ts). Ảnh tới đây thường 100–300KB; 1MB là trần an toàn, vẫn
// dưới xa giới hạn ~4,5MB thân request của Vercel.
//
// Chỉ học viên mới có ảnh nền — giáo viên chỉ được GỠ ảnh (removeStudentCoverImage).
const MAX_BYTES = 1024 * 1024;

// Cố tình KHÔNG nhận SVG: định dạng đó chứa được script.
const allowedTypes = new Set(["image/webp", "image/png", "image/jpeg"]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    return NextResponse.json({ error: "Cần đăng nhập bằng tài khoản học viên." }, { status: 403 });
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
    return NextResponse.json({ error: "Ảnh quá lớn. Hãy chọn ảnh khác." }, { status: 413 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Định dạng ảnh không hỗ trợ (chỉ PNG, JPG, WEBP)." },
      { status: 400 }
    );
  }

  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";

  try {
    const blob = await put(`covers/${session.user.id}.${extension}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
