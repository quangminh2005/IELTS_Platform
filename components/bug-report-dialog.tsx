"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useBugReport } from "@/components/bug-report-context";
import { useToast } from "@/components/toast";
import { createBugReport } from "@/lib/actions/bug-reports";
import {
  BUG_CATEGORIES,
  BUG_DESCRIPTION_MAX,
  BUG_IMAGE_MAX_BYTES,
  type BugCategory
} from "@/lib/bug-report";

// Cạnh dài tối đa của ảnh sau khi thu nhỏ trong trình duyệt. Ảnh chụp màn hình
// điện thoại thường 1170x2532 (~1–3MB PNG) -> sau bước này còn vài trăm KB.
const MAX_EDGE = 1280;

async function shrinkScreenshot(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Trình duyệt không xử lý được ảnh này.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));

  // Safari cũ không xuất được webp: trả về PNG (type khác) hoặc null -> rơi về JPEG.
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob("image/jpeg");
  }
  if (!blob) {
    throw new Error("Không nén được ảnh.");
  }
  return blob;
}

type ImageState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

export function BugReportDialog() {
  const { isOpen, close, attemptContext } = useBugReport();
  const { notify } = useToast();
  const pathname = usePathname();
  const [category, setCategory] = useState<BugCategory | null>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<ImageState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Portal chỉ dựng được sau khi mount (document chưa có lúc render server).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Esc để đóng.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!mounted || !isOpen) {
    return null;
  }

  const reset = () => {
    setCategory(null);
    setDescription("");
    setImage({ status: "idle" });
    setError(null);
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setImage({ status: "uploading" });
    try {
      const shrunk = await shrinkScreenshot(file);
      if (shrunk.size > BUG_IMAGE_MAX_BYTES) {
        throw new Error("Ảnh quá lớn, hãy chụp lại phần cần báo.");
      }
      const extension = shrunk.type === "image/jpeg" ? "jpg" : "webp";
      const body = new FormData();
      body.append("file", new File([shrunk], `bug.${extension}`, { type: shrunk.type }));
      const response = await fetch("/api/student/bug-image", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Không tải được ảnh.");
      }
      setImage({ status: "done", url: data.url });
    } catch (caught) {
      setImage({
        status: "error",
        message: caught instanceof Error ? caught.message : "Không tải được ảnh."
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!category) {
      setError("Hãy chọn loại lỗi.");
      return;
    }
    if (!description.trim()) {
      setError("Hãy mô tả lỗi bạn gặp.");
      return;
    }
    if (image.status === "uploading") {
      setError("Ảnh đang tải lên, chờ một chút.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("category", category);
    formData.set("description", description);
    if (image.status === "done") formData.set("imageUrl", image.url);
    formData.set("pageUrl", `${pathname}${window.location.search}`);
    formData.set("userAgent", navigator.userAgent);
    formData.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    if (attemptContext) {
      formData.set("attemptId", attemptContext.attemptId);
      formData.set(
        "contextJson",
        JSON.stringify({ unitTitle: attemptContext.unitTitle, step: attemptContext.step })
      );
    }

    try {
      const result = await createBugReport(formData);
      if (result.ok) {
        notify(result);
        reset();
        close();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Không gửi được, kiểm tra kết nối rồi thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    // z-[70]: trên màn làm bài (fixed z-50) và hộp xác nhận nộp bài (z-[60]).
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={close} aria-hidden="true" />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-pop sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="bug-report-title" className="text-base font-bold">
              Báo lỗi cho giáo viên
            </h2>
            <p className="text-xs text-muted-foreground">
              Trang, thiết bị và bài đang làm sẽ tự gửi kèm.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition hover:border-primary hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <fieldset>
            <legend className="text-sm font-semibold">Loại lỗi</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {BUG_CATEGORIES.map((item) => {
                const active = category === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-lg border border-primary bg-primary/10 px-3 py-2 text-left text-sm font-semibold text-primary"
                        : "rounded-lg border border-border bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary"
                    }
                  >
                    <span className="block">{item.label}</span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-semibold">Mô tả</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, BUG_DESCRIPTION_MAX))}
              rows={4}
              placeholder="Bạn bấm gì, thấy gì, mong đợi gì?"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <span className="mt-1 block text-right text-[11px] text-muted-foreground">
              {description.length}/{BUG_DESCRIPTION_MAX}
            </span>
          </label>

          <div>
            <span className="text-sm font-semibold">Ảnh chụp màn hình (tuỳ chọn)</span>
            <div className="mt-2 flex items-center gap-3">
              {image.status === "done" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt="Ảnh đính kèm"
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
              ) : null}
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary">
                {image.status === "uploading"
                  ? "Đang tải ảnh…"
                  : image.status === "done"
                    ? "Đổi ảnh"
                    : "Chọn ảnh"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={image.status === "uploading"}
                  onChange={(event) => void onPickImage(event.target.files?.[0])}
                />
              </label>
              {image.status === "done" ? (
                <button
                  type="button"
                  onClick={() => setImage({ status: "idle" })}
                  className="text-sm text-muted-foreground hover:text-destructive"
                >
                  Bỏ ảnh
                </button>
              ) : null}
            </div>
            {image.status === "error" ? (
              <p className="mt-1 text-xs text-destructive">{image.message} Bạn vẫn có thể gửi không kèm ảnh.</p>
            ) : null}
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <Link href="/student/bugs" onClick={close} className="text-xs text-muted-foreground hover:text-primary hover:underline">
            Xem các báo lỗi đã gửi
          </Link>
          <button
            type="submit"
            disabled={submitting || image.status === "uploading"}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Đang gửi…" : "Gửi cho giáo viên"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
