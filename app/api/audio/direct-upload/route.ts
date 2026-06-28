import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Tải audio "qua server": trình duyệt POST file tới đây, server đẩy lên Vercel
// Blob bằng BLOB_READ_WRITE_TOKEN. Đáng tin cậy hơn client upload (không phụ
// thuộc trình duyệt kết nối thẳng tới blob.vercel-storage.com). Hạn chế: body
// của serverless function ~4.5MB, nên hợp với từng part audio đã nén.
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
      { error: "File quá lớn để tải thẳng (giới hạn ~4.5MB). Hãy nén MP3 nhẹ hơn hoặc dán link audio." },
      { status: 413 }
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Không nhận được file." }, { status: 400 });
  }

  try {
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "audio/mpeg"
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
