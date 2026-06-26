import type { Metadata } from "next";
import { RememberGoogleAccount } from "@/components/remember-google-account";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS Platform",
  description: "Teacher-led IELTS practice workspace"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem("ielts-platform-theme");
                  var theme = saved === "light" || saved === "dark"
                    ? saved
                    : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (_) {}
              })();
            `
          }}
        />
        <RememberGoogleAccount />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
