"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import { LoginStaticBackground } from "@/components/ui/login-static-background";
import {
  getLoginBackgroundPalette,
  LOGIN_SHADER_MIN_WIDTH,
  shouldLoadLoginShader,
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
    const context = probe.getContext("webgl") ?? probe.getContext("experimental-webgl");

    // Trả ngữ cảnh vừa mượn lại cho máy. Trình duyệt chỉ cho phép một số ngữ
    // cảnh WebGL sống cùng lúc; giữ luôn ngữ cảnh thăm dò này thì chính shader
    // ở dưới lại có thể không xin được ngữ cảnh nào nữa.
    if (context && "getExtension" in context) {
      (context as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    }

    return Boolean(context);
  } catch {
    return false;
  }
}

/**
 * Lưới đỡ cho nền động.
 *
 * Nền chỉ là mảng TRANG TRÍ, nhưng trước đây nó nằm trần trong cây React nên
 * một lỗi lúc tải/khởi tạo shader là kéo sập cả trang đăng nhập — học viên
 * thấy "Application error: a client-side exception has occurred" và mất hẳn
 * đường vào lớp. Từ nay hỏng thì nó lặng lẽ biến mất, nền tĩnh ở dưới vẫn còn.
 */
class LoginBackgroundBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Nền của trang đăng nhập: nền tĩnh luôn nằm dưới, lớp shader chỉ chồng lên khi
// máy đáp ứng được. Rơi về nền tĩnh khi: người dùng bật giảm chuyển động, máy
// không có WebGL, màn hình hẹp cỡ điện thoại, chunk shader chưa tải xong, hoặc
// shader ném lỗi (lưới đỡ ở trên bắt).
export function LoginShaderBackground() {
  const [palette, setPalette] = useState<LoginBackgroundPalette | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const wideScreen = window.matchMedia(`(min-width: ${LOGIN_SHADER_MIN_WIDTH}px)`);

    const sync = () => {
      const allowed = shouldLoadLoginShader({
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        hasWebgl: hasWebgl(),
        viewportWidth: window.innerWidth
      });

      setPalette(allowed ? getLoginBackgroundPalette(root.dataset.theme) : null);
    };

    sync();

    // Nút chuyển sáng/tối ghi thẳng vào data-theme, không qua context nào.
    const observer = new MutationObserver(sync);

    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    // Xoay ngang máy hoặc kéo rộng cửa sổ thì tính lại.
    wideScreen.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      wideScreen.removeEventListener("change", sync);
    };
  }, []);

  return (
    <>
      <LoginStaticBackground />
      {palette ? (
        <LoginBackgroundBoundary>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-fade-in-soft"
          >
            <LoginShaderCanvas palette={palette} />
          </div>
        </LoginBackgroundBoundary>
      ) : null}
    </>
  );
}
