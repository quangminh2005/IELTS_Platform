"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

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

    // Không để treo vô hạn: nếu sau 5 phút chưa xong thì báo lỗi.
    const timeout = new Promise<never>((_, reject) =>
      window.setTimeout(
        () =>
          reject(
            new Error(
              "Quá thời gian tải lên. Nếu % không nhúc nhích: kiểm tra đã Redeploy sau khi tạo kho Vercel Blob chưa, hoặc dán trực tiếp link audio vào ô bên trên."
            )
          ),
        300_000
      )
    );

    try {
      const blob = await Promise.race([
        upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/audio/upload",
          // Tải theo nhiều phần: ổn định hơn với file audio lớn, tránh treo
          // do một kết nối đơn lẻ bị nghẽn.
          multipart: true,
          onUploadProgress: (event) => {
            setMessage(`Đang tải "${file.name}"… ${Math.round(event.percentage)}%`);
          }
        }),
        timeout
      ]);

      setUrl(blob.url);
      setStatus("idle");
      setMessage("Tải lên thành công.");
    } catch (error) {
      setStatus("error");
      setMessage(`Lỗi tải lên: ${(error as Error).message}`);
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
