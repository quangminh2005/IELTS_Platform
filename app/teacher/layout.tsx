import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";

export default function TeacherLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <AppShell role="teacher">{children}</AppShell>
    </ToastProvider>
  );
}
