// Phụ huynh mở link đã bị thu hồi / đã tạo lại / chép thiếu ký tự. Trước đây rơi
// vào trang 404 tiếng Anh mặc định của Next ("This page could not be found"),
// phụ huynh tưởng web hỏng. Trang này nói rõ phải làm gì: xin cô link mới.
//
// Cố ý KHÔNG có nút về trang chủ / đăng nhập — phụ huynh không có tài khoản.
export default function ParentLinkNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-16 text-[15px]">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
            <path d="M9 17H7A5 5 0 0 1 7 7h2" />
            <path d="M15 7h2a5 5 0 0 1 4 8" />
            <path d="M8 12h4" />
            <path d="m2 2 20 20" />
          </svg>
        </span>
        <p className="mt-6 text-sm font-semibold text-primary">Báo cáo học tập</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight">
          Link này không còn dùng được
        </h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Có thể giáo viên đã đổi sang link mới, hoặc link bị chép thiếu khi gửi qua tin
          nhắn.
        </p>
        <p className="mt-3 leading-7 text-muted-foreground">
          Anh/chị vui lòng nhắn cô giáo để nhận link báo cáo mới của con.
        </p>
      </div>
    </main>
  );
}
