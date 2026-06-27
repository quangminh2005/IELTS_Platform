import { ThemeToggle } from "@/components/theme-toggle";

export default function WaitingPage() {
  return (
    <main className="relative min-h-screen text-foreground">
      <ThemeToggle />
      <section className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-pop sm:p-10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <p className="mt-6 text-sm font-semibold text-accent">Đang chờ duyệt</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground">
            Email Google của bạn chưa được thêm vào lớp.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Hãy nhờ giáo viên thêm đúng email Google mà bạn vừa dùng để đăng nhập vào danh sách học
            viên, sau đó đăng nhập lại.
          </p>
        </div>
      </section>
    </main>
  );
}
