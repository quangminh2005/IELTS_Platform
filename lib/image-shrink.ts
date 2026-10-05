// Thu nhỏ ảnh NGAY TRONG TRÌNH DUYỆT trước khi gửi lên Blob — ảnh gốc từ điện
// thoại thường 3–5MB. Chỉ chạy phía client (canvas + createImageBitmap).

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh."))),
      type,
      quality
    );
  });
}

// Avatar: cắt vuông phần giữa + thu về 256px webp (còn khoảng 20KB).
export async function shrinkToSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không xử lý được ảnh này.");
  }

  // Cắt phần vuông ở giữa ảnh gốc rồi vẽ đầy khung 256x256.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256
  );
  bitmap.close();

  return canvasToBlob(canvas, "image/webp", 0.85);
}

const COVER_MAX_SIDE = 1600;

// Ảnh nền bìa: giữ nguyên tỉ lệ, cạnh dài tối đa 1600px. Bìa hiện kiểu
// object-cover nên không cần cắt sẵn. Safari cũ không XUẤT được webp (toBlob trả
// PNG, rất nặng) — khi đó nén lại bằng JPEG.
export async function shrinkCover(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, COVER_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không xử lý được ảnh này.");
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob = await canvasToBlob(canvas, "image/webp", 0.82);
  if (blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.82);
  }

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `cover.${extension}`, { type: blob.type || "image/jpeg" });
}
