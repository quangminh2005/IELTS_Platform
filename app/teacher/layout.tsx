import { AppShell } from "@/components/app-shell";

export default function TeacherLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell role="teacher">{children}</AppShell>;
}
