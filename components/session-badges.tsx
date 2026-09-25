// Nhãn trạng thái một buổi học, dùng chung cho trang giáo viên và học viên.
const BASE = "rounded-full border px-2 py-0.5 text-xs font-semibold";

export function SessionBadges({ status, mode, kind }: { status: string; mode: string; kind: string }) {
  return (
    <>
      {status === "cancelled" ? (
        <span className={`${BASE} border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-300`}>Nghỉ</span>
      ) : mode === "online" ? (
        <span className={`${BASE} border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-300`}>Online</span>
      ) : (
        <span className={`${BASE} border-border bg-muted text-muted-foreground`}>Trực tiếp</span>
      )}
      {kind === "makeup" ? (
        <span className={`${BASE} border-violet-400/50 bg-violet-500/10 text-violet-700 dark:text-violet-300`}>
          Học bù
        </span>
      ) : null}
      {kind === "extra" ? (
        <span className={`${BASE} border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}>
          Tăng cường
        </span>
      ) : null}
    </>
  );
}
