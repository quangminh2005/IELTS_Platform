"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { LoginStaticBackground } from "@/components/ui/login-static-background";
import {
  getLoginBackgroundPalette,
  type LoginBackgroundPalette
} from "@/lib/login-background-theme";

// Nạp trễ để three không nằm trong bundle máy chủ lẫn bundle chung.
const LoginShaderCanvas = dynamic(() => import("@/components/ui/login-shader-canvas"), {
  ssr: false,
  loading: () => null
});

function hasWebgl(): boolean {
  try {
    const probe = document.createElement("canvas");

    return Boolean(probe.getContext("webgl") ?? probe.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

// Nền của trang đăng nhập: nền tĩnh luôn nằm dưới, lớp shader chỉ chồng lên khi
// máy đáp ứng được. Ba trường hợp rơi về nền tĩnh: người dùng bật giảm chuyển động,
// máy không có WebGL, hoặc chunk shader chưa tải xong.
export function LoginShaderBackground() {
  const [palette, setPalette] = useState<LoginBackgroundPalette | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (!hasWebgl()) {
      return;
    }

    const root = document.documentElement;
    const sync = () => setPalette(getLoginBackgroundPalette(root.dataset.theme));

    sync();

    // Nút chuyển sáng/tối ghi thẳng vào data-theme, không qua context nào.
    const observer = new MutationObserver(sync);

    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <LoginStaticBackground />
      {palette ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 animate-fade-in-soft"
        >
          <LoginShaderCanvas palette={palette} />
        </div>
      ) : null}
    </>
  );
}
