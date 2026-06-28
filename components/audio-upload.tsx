"use client";

import { type ChangeEvent, useRef, useState } from "react";

type AudioUploadProps = {
  id: string;
  name?: string;
  defaultValue?: string;
};

// Tải file lên qua route server của chính web (server đẩy lên Vercel Blob).
// Dùng XHR để hiển thị % tiến trình và bắt được lỗi file quá lớn (413).
function uploadViaServer(file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/audio/direct-upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText).url as string);
        } catch {
          reject(new Error("Phản hồi không hợp lệ từ máy chủ."));
        }
        return;
      }

      if (xhr.status === 413) {
        reject(
          new Error(
            "File quá lớn để tải thẳng (giới hạn ~4.5MB). Hãy nén MP3 nhẹ hơn (vd 64kbps) hoặc dán link audio vào ô bên trên."
          )
        );
        return;
      }

      let message = `Lỗi ${xhr.status}`;
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {
        // giữ message mặc định
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Lỗi mạng khi tải lên."));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

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
      const blobUrl = await uploadViaServer(file, (percent) => {
        setMessage(`Đang tải "${file.name}"… ${percent}%`);
      });

      setUrl(blobUrl);
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
