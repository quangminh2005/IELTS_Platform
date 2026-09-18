"use client";

import { useEffect, useState } from "react";

// Đọc từ bằng giọng sẵn có của trình duyệt (speechSynthesis) — không tốn API,
// chạy được trên Safari iOS 15. Máy không hỗ trợ thì không hiện nút.
export function SpeakButton({
  text,
  className = ""
}: {
  text: string;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  if (!supported) {
    return null;
  }

  const speak = () => {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.9;

    // Ưu tiên giọng Anh-Anh nếu máy có; không thì để trình duyệt tự chọn theo lang.
    const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith("en-gb"));

    if (voice) {
      utterance.voice = voice;
    }

    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`Nghe phát âm ${text}`}
      title="Nghe phát âm"
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary ${className}`}
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M3 7.5v5h3l4 3.5v-12l-4 3.5H3z" />
        <path d="M13 6.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M15.5 4a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  );
}
