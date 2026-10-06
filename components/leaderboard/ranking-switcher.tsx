import Link from "next/link";
import { rankingHref, type RankingLinkContext, type RankingParams } from "@/lib/leaderboard";

const BOARDS = [
  { key: "xp", label: "🏆 Học Bá" },
  { key: "streak", label: "🔥 Chuỗi" },
  { key: "class", label: "📊 Điểm lớp" }
] as const;

function tabClass(active: boolean): string {
  return `rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
    active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
  }`;
}

// Chọn bảng / phạm vi / lớp — toàn bộ là link (?board=&scope=&classId=), không cần JS.
export function RankingSwitcher({
  params,
  classes,
  context
}: {
  params: RankingParams;
  classes: { id: string; name: string }[];
  context: RankingLinkContext;
}) {
  const showScope = params.board !== "class";
  const showClasses = classes.length > 1 && (params.board === "class" || params.scope === "class");

  return (
    <div className="space-y-3">
      <nav
        aria-label="Chọn bảng xếp hạng"
        className="grid grid-cols-3 rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20"
      >
        {BOARDS.map((board) => (
          <Link
            key={board.key}
            href={rankingHref({ ...params, board: board.key }, context)}
            className={tabClass(params.board === board.key)}
          >
            {board.label}
          </Link>
        ))}
      </nav>

      {showScope ? (
        <nav
          aria-label="Phạm vi"
          className="inline-flex rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20"
        >
          <Link href={rankingHref({ ...params, scope: "class" }, context)} className={tabClass(params.scope === "class")}>
            Lớp
          </Link>
          <Link
            href={rankingHref({ ...params, scope: "school" }, context)}
            className={tabClass(params.scope === "school")}
          >
            Toàn trường
          </Link>
        </nav>
      ) : null}

      {showClasses ? (
        <div className="flex flex-wrap gap-2">
          {classes.map((classItem) => (
            <Link
              key={classItem.id}
              href={rankingHref({ ...params, classId: classItem.id }, context)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                classItem.id === params.classId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {classItem.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
