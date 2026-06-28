// Skeleton hiển thị ngay khi điều hướng giữa các trang giáo viên,
// trong khi Server Component đang lấy dữ liệu. Tránh cảm giác "đứng hình".
export default function TeacherLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <header className="space-y-3">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-72 max-w-full rounded bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-3 h-8 w-16 rounded bg-muted" />
            <div className="mt-2 h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-card"
          >
            <div className="space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-28 rounded bg-muted" />
            </div>
            <div className="h-8 w-20 rounded bg-muted" />
          </div>
        ))}
      </section>
    </div>
  );
}
