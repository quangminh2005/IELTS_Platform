"use client";

import { upload } from "@vercel/blob/client";
import { type ChangeEvent, useRef, useState } from "react";

type AudioUploadProps = {
  id: string;
  name?: string;
  defaultValue?: string;
};

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

export function AudioUpload({ id, name = "audioUrl", defaultValue = "" }: AudioUploadProps) {
  const [url, setUrl] = useState(defaultValue);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setStatus("uploading");
    setMessage(`Đang tải "${file.name}"… 0%`);

    try {
      // Tải THẲNG từ trình duyệt lên Vercel Blob (qua token từ /api/audio/upload).
      // Tránh giới hạn ~4.5MB của serverless function — hỗ trợ tới 50MB, dùng
      // multipart cho file lớn (chia nhỏ, tải song song, tự thử lại phần lỗi).
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/audio/upload",
        multipart: true,
        onUploadProgress: ({ percentage }) => {
          setMessage(`Đang tải "${file.name}"… ${Math.round(percentage)}%`);
        }
      });

      setUrl(blob.url);
      setStatus("idle");
      setMessage("Tải lên thành công.");
    } catch (error) {
      setStatus("error");
      setMessage(
        `Lỗi tải lên: ${(error as Error).message}. Nếu file > 50MB, hãy nén nhẹ hơn hoặc dán link audio vào ô bên trên.`
      );
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  return (
    <div>
      <input
        id={id}
        name={name}
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://....mp3 (hoặc tải file bên dưới)"
        className={inputClass}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={handleFile}
          disabled={status === "uploading"}
          className="text-xs file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:font-semibold"
        />
        {message ? (
          <span
            className={
              status === "error"
                ? "text-xs text-red-600 dark:text-red-300"
                : "text-xs text-muted-foreground"
            }
          >
            {message}
          </span>
        ) : null}
      </div>
      {url ? (
        <audio controls src={url} className="mt-2 w-full">
          <track kind="captions" />
        </audio>
      ) : null}
    </div>
  );
}
