import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RememberGoogleAccount } from "@/components/remember-google-account";
import { Preloader } from "@/components/ui/preloader";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS Platform — Luyện thi IELTS cùng giáo viên",
  description: "Không gian luyện thi IELTS do giáo viên dẫn dắt: giao bài, làm bài, chấm chữa."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem("ielts-platform-theme");
                  var theme = saved === "light" || saved === "dark"
                    ? saved
                    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (_) {}
              })();
            `
          }}
        />
        <Preloader />
        <RememberGoogleAccount />
        {children}
        {/* Đo tốc độ trang từ máy người dùng thật (LCP/CLS/INP/TTFB theo từng
            route). Chỉ gửi dữ liệu trên bản deploy Vercel — chạy localhost thì
            im lặng. Phải bật thêm ở Vercel → project → tab Speed Insights. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
