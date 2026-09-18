import Link from "next/link";
import { StudentAvatar } from "@/components/student-avatar";
import type { VocabStudentRow } from "@/lib/vocab-teacher-stats";
import { formatVietnamDate } from "@/lib/vocab-words";

// Bảng "Ôn từ vựng" trong trang Tự luyện của giáo viên: mỗi học viên một dòng.
// Dùng chung bộ lọc lớp / khoảng thời gian với bảng tự luyện phía trên.
export function VocabProgressTable({
  rows,
  rangeLabel
}: {
  rows: VocabStudentRow[];
  rangeLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-base font-semibold">Ôn từ vựng</h3>
        <p className="text-xs text-muted-foreground">
          Ngày ôn tính trong {rangeLabel.toLowerCase()}; chuỗi, từ đã gặp và tỉ lệ đúng tính
          từ đầu.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Học viên</th>
              <th className="px-3 py-2 text-right font-medium">Ngày ôn</th>
              <th className="px-3 py-2 text-right font-medium">Chuỗi</th>
              <th className="px-3 py-2 text-right font-medium">Từ đã gặp</th>
              <th className="px-3 py-2 text-right font-medium">Đúng</th>
              <th className="px-4 py-2 text-right font-medium">Ôn gần nhất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const never = row.lastQuizDate === null;

              return (
                <tr key={row.id} className={never ? "opacity-60" : ""}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/teacher/students/${row.id}`}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <StudentAvatar
                        avatarUrl={row.avatarUrl}
                        avatarPreset={row.avatarPreset}
                        userImage={row.userImage}
                        displayName={row.displayName}
                        size="sm"
                      />
                      <span className="font-medium">{row.displayName}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.daysInRange}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.streakDays > 0 ? `🔥 ${row.streakDays}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.wordsSeen}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.accuracyPercent === null ? "—" : `${row.accuracyPercent}%`}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {row.lastQuizDate ? formatVietnamDate(row.lastQuizDate) : "chưa ôn"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
