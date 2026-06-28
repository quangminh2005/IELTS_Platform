// Skeleton hiển thị ngay khi điều hướng giữa các trang học viên,
// trong khi Server Component đang lấy dữ liệu. Tránh cảm giác "đứng hình".
export default function StudentLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <header className="space-y-3">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-8 w-64 max-w-full rounded bg-muted" />
        <div className="h-4 w-96 max-w-full rounded bg-muted" />
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-12 rounded bg-muted" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="space-y-2">
                <div className="h-4 w-52 max-w-full rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-16 rounded-full bg-muted" />
                <div className="h-8 w-20 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
