import { ReactNode } from "react";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import { LoginShaderBackground } from "@/components/ui/login-shader-background";

const FEATURES = [
  { step: "01", title: "Giao bài", desc: "Tạo đề từ kho tài liệu" },
  { step: "02", title: "Làm bài", desc: "Trải nghiệm như thi thật" },
  { step: "03", title: "Chấm chữa", desc: "Phản hồi chi tiết" }
];

// Khung chung cho cả trang chọn vai trò lẫn 2 trang đăng nhập riêng.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden text-foreground">
      <LoginShaderBackground />
      <AnimatedThemeToggle className="fixed right-4 top-4 z-50 shadow-card" />
      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 pb-20 pt-10 lg:grid-cols-[1fr_440px] lg:gap-16 lg:pb-28 lg:pt-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-primary shadow-card">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
              IE
            </span>
            IELTS Platform
          </span>
          <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Không gian luyện thi IELTS cho lớp học của bạn.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Giáo viên đăng nhập bằng tài khoản được cấp. Học viên đăng nhập bằng đúng email Google mà
            giáo viên đã thêm vào lớp.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card/90 p-4 shadow-card backdrop-blur"
              >
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {feature.step}
                </span>
                <span className="block text-sm font-semibold text-foreground">{feature.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{feature.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-pop sm:p-7">{children}</div>
      </section>
    </main>
  );
}
