import type { Metadata } from "next";
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
