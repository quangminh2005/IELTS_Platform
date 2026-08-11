import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";

export default function StudentLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <AppShell role="student">{children}</AppShell>
    </ToastProvider>
  );
}
