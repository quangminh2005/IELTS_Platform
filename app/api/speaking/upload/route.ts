import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Học sinh ghi âm bài Speaking rồi tải THẲNG lên Vercel Blob (client upload qua
// token). Khác /api/audio/upload (chỉ giáo viên) — route này cho cả học sinh đã
// đăng nhập, để nộp audio bài làm.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth();

        if (!session?.user?.id) {
          throw new Error("Bạn cần đăng nhập để nộp bài ghi âm.");
        }

        return {
          allowedContentTypes: [
            "audio/webm",
            "video/webm",
            "audio/ogg",
            "audio/mp4",
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/aac",
            "audio/x-m4a"
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {
        // Trình duyệt đã nhận URL blob trực tiếp từ upload().
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
