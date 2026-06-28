"use client";

import { type ChangeEvent, useRef, useState } from "react";

type ImageUploadProps = {
  id: string;
  // Tên field hidden gửi kèm form; server đọc field này (JSON mảng URL).
  name?: string;
  defaultValue?: string[];
};

function uploadViaServer(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/image/direct-upload");

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
        reject(new Error("Ảnh quá lớn (giới hạn ~4.5MB). Hãy nén ảnh hoặc dán link ảnh."));
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
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2";

export function ImageUpload({ id, name = "imageUrlsJson", defaultValue = [] }: ImageUploadProps) {
  const [urls, setUrls] = useState<string[]>(defaultValue);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    setStatus("uploading");

    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        setMessage(`Đang tải ảnh ${i + 1}/${files.length}…`);
        uploaded.push(await uploadViaServer(files[i]));
      }
      setUrls((previous) => [...previous, ...uploaded]);
      setStatus("idle");
      setMessage(`Đã tải ${uploaded.length} ảnh.`);
    } catch (error) {
      setStatus("error");
      setMessage(`Lỗi tải lên: ${(error as Error).message}`);
    } finally {
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  function addManual() {
    const value = manual.trim();
    if (!value) {
      return;
    }
    setUrls((previous) => [...previous, value]);
    setManual("");
  }

  function removeAt(index: number) {
    setUrls((previous) => previous.filter((_, i) => i !== index));
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(urls)} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          id={id}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
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

      <div className="mt-2 flex gap-2">
        <input
          type="url"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addManual();
            }
          }}
          placeholder="…hoặc dán link ảnh rồi bấm Thêm"
          className={inputClass}
        />
        <button
          type="button"
          onClick={addManual}
          className="shrink-0 rounded-md border border-border px-3 text-sm font-medium hover:border-primary"
        >
          Thêm
        </button>
      </div>

      {urls.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Ảnh ${index + 1}`} className="h-24 w-full object-contain bg-muted/40" />
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
                title="Xoá ảnh"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
