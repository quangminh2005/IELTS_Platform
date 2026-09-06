import Link from "next/link";
import { StudentAvatar } from "@/components/student-avatar";
import { formatDuration } from "@/lib/format-duration";
import { daysAgoLabel } from "@/lib/student-score";
import type {
  PracticeRange,
  PracticeSort,
  PracticeStudentRow
} from "@/lib/practice-progress";

// Học viên trong bảng: đủ trường để vẽ avatar + tên, không hơn.
export type PracticeTableStudent = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  userImage: string | null;
};

type PracticeProgressTableProps = {
  rows: PracticeStudentRow<PracticeTableStudent>[];
  sort: PracticeSort;
  range: PracticeRange;
  classId: string | null;
};

// Cột "Số lượt" phải đủ rộng cho chip "Chưa luyện" nằm gọn một dòng. Các cột phụ
// giữ hẹp hết mức đọc được: khung nội dung của trang giáo viên chỉ rộng ~730px nên
// cột phụ ăn thêm bao nhiêu là cột TÊN HỌC VIÊN mất bấy nhiêu (tên dài bị cắt cụt).
const COLUMN_CLASS =
  "grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 md:grid-cols-[minmax(0,1fr)_6.5rem_3.5rem_6rem_7rem_4.5rem]";

function percentLabel(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

// Cột tiêu đề bấm được để đổi cách sắp xếp. Giữ nguyên lớp + khoảng thời gian đang xem.
function SortLink({
  label,
  sort,
  current,
  range,
  classId,
  className = ""
}: {
  label: string;
  sort: PracticeSort;
  current: PracticeSort;
  range: PracticeRange;
  classId: string | null;
  className?: string;
}) {
  const params = new URLSearchParams({ range, sort });

  if (classId) {
    params.set("classId", classId);
  }

  const active = sort === current;

  return (
    <Link
      href={`/teacher/practice?${params.toString()}`}
      className={`transition hover:text-primary ${active ? "text-primary" : ""} ${className}`}
      aria-current={active ? "true" : undefined}
    >
      {label}
      {active ? " ↓" : ""}
    </Link>
  );
}

export function PracticeProgressTable({ rows, sort, range, classId }: PracticeProgressTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div
        className={`${COLUMN_CLASS} border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}
      >
        <SortLink label="Học viên" sort="name" current={sort} range={range} classId={classId} />
        <SortLink label="Số lượt" sort="rounds" current={sort} range={range} classId={classId} />
        <span className="hidden md:block">Số đề</span>
        <SortLink
          label="Gần nhất"
          sort="attention"
          current={sort}
          range={range}
          classId={classId}
          className="hidden md:block"
        />
        <span className="hidden md:block">Thời gian</span>
        <SortLink
          label="Điểm TB"
          sort="score"
          current={sort}
          range={range}
          classId={classId}
          className="hidden md:block"
        />
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => {
          const chuaLuyen = row.practice.rounds === 0;

          return (
            <article key={row.id} className={`${COLUMN_CLASS} items-center px-5 py-4`}>
              <div className="flex min-w-0 items-center gap-3">
                <StudentAvatar
                  avatarUrl={row.avatarUrl}
                  avatarPreset={row.avatarPreset}
                  userImage={row.userImage}
                  displayName={row.displayName}
                  size="list"
                />
                <div className="min-w-0">
                  <Link
                    href={`/teacher/students/${row.id}`}
                    // Trên điện thoại để tên xuống dòng (còn chỗ), từ md mới cắt cụt
                    // vì lúc đó tên phải nằm gọn một dòng cho thẳng hàng với các cột.
                    className="block font-semibold transition hover:text-primary hover:underline md:truncate"
                  >
                    {row.displayName}
                  </Link>
                  {/* Trên điện thoại các cột phụ gộp xuống dưới tên thay vì cuộn ngang. */}
                  <p className="mt-1 grid gap-1 text-sm text-muted-foreground md:hidden">
                    <span>Số đề: {row.practice.materialCount}</span>
                    <span>Gần nhất: {daysAgoLabel(row.practice.daysSinceLastPractice)}</span>
                    <span>
                      Thời gian:{" "}
                      {row.practice.totalSeconds > 0
                        ? formatDuration(row.practice.totalSeconds)
                        : "—"}
                    </span>
                    <span>Điểm TB: {percentLabel(row.practice.averagePercent)}</span>
                  </p>
                </div>
              </div>

              <p className="text-sm tabular-nums">
                {chuaLuyen ? (
                  <span className="inline-flex whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Chưa luyện
                  </span>
                ) : (
                  <span className="font-semibold text-primary">{row.practice.rounds}</span>
                )}
              </p>

              <p className="hidden text-sm tabular-nums md:block">
                {chuaLuyen ? "—" : row.practice.materialCount}
              </p>
              <p className="hidden text-sm tabular-nums md:block">
                {daysAgoLabel(row.practice.daysSinceLastPractice)}
              </p>
              <p className="hidden text-sm tabular-nums md:block">
                {row.practice.totalSeconds > 0 ? formatDuration(row.practice.totalSeconds) : "—"}
              </p>
              <p className="hidden text-sm font-semibold tabular-nums md:block">
                {percentLabel(row.practice.averagePercent)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
