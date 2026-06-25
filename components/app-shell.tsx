import Link from "next/link";
import type { ReactNode } from "react";

type AppShellRole = "teacher" | "student";

type AppShellProps = {
  children: ReactNode;
  role: AppShellRole;
};

const navByRole: Record<AppShellRole, Array<{ href: string; label: string; hint: string }>> = {
  teacher: [
    { href: "/teacher", label: "Dashboard", hint: "Overview" },
    { href: "/teacher/classes", label: "Classes", hint: "Manage students" },
    { href: "/teacher/materials", label: "Materials", hint: "Library" },
    { href: "/teacher/assignments", label: "Assignments", hint: "Homework" },
    { href: "/teacher/review", label: "Review", hint: "Manual scoring" }
  ],
  student: [
    { href: "/student", label: "Dashboard", hint: "Progress" },
    { href: "/student/assignments", label: "Assignments", hint: "Practice" },
    { href: "/student/results", label: "Results", hint: "Feedback" },
    { href: "/student/ranking", label: "Ranking", hint: "Classmates" }
  ]
};

export function AppShell({ children, role }: AppShellProps) {
  const navItems = navByRole[role];
  const title = role === "teacher" ? "Teacher Workspace" : "Student Workspace";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-border bg-black/20 px-5 py-5 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href={role === "teacher" ? "/teacher" : "/student"} className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                IELTS Platform
              </span>
              <h1 className="mt-1 text-xl font-semibold">{title}</h1>
            </Link>
            <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium capitalize text-primary lg:mt-5 lg:inline-block">
              {role}
            </span>
          </div>

          <nav className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-border bg-muted/45 px-4 py-3 transition hover:border-primary/60 hover:bg-primary/10"
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.hint}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-md border border-border bg-muted/35 p-4">
            <p className="text-sm font-medium">MVP status</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Classes, enrollment, assignments, and review data are wired to the shared Prisma
              schema.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
