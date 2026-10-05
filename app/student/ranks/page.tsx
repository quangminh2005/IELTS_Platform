import Link from "next/link";
import { redirect } from "next/navigation";
import { RankExplorer } from "@/components/rank-explorer";
import { RankMedal } from "@/components/rank-medal";
import { auth } from "@/lib/auth";
import { COINS_PER_XP } from "@/lib/coins";
import {
  XP_HIDDEN_AUDIO_FACTOR,
  XP_MANUAL_UNIT,
  XP_UNIT_ACCURACY_MAX,
  XP_UNIT_BASE,
  XP_VOCAB_CARDS_PER_POINT,
  XP_VOCAB_DAILY_CAP
} from "@/lib/monthly-xp";
import { prisma } from "@/lib/prisma";
import { TOTAL_LEVELS, XP_RANKS, getXpProgress, levelName } from "@/lib/xp-rank";
import { getLifetimeXp } from "@/lib/xp-rank-data";

export const dynamic = "force-dynamic";

const xpFormat = new Intl.NumberFormat("vi-VN");

type EarnRule = { title: string; reward: string; example: string; note?: string };

// "Cách kiếm XP" đọc THẲNG hằng số trong lib/monthly-xp.ts + lib/coins.ts — đổi hệ
// số ở đó thì trang này tự đúng theo, không bao giờ lệch với cách cộng thật.
const exampleAccuracy = 0.8;
const exampleUnitXp = XP_UNIT_BASE + Math.round(XP_UNIT_ACCURACY_MAX * exampleAccuracy);

const EARN_GROUPS: { title: string; description: string; rules: EarnRule[] }[] = [
  {
    title: "Bài làm (bài giao · tự luyện)",
    description: "Mỗi phần đề nộp xong là có XP — làm càng đúng, XP càng nhiều.",
    rules: [
      {
        title: "Phần tự chấm (Listening · Reading · bài điền)",
        reward: `${XP_UNIT_BASE} + tối đa ${XP_UNIT_ACCURACY_MAX} XP`,
        example: `VD: đúng ${Math.round(exampleAccuracy * 100)}% → ${exampleUnitXp} XP`,
        note: `${XP_UNIT_BASE} XP khi nộp, cộng thêm theo % câu đúng.`
      },
      {
        title: "Phần Writing / Speaking có bài làm",
        reward: `+${XP_MANUAL_UNIT} XP / phần`,
        example: `VD: nộp Task 1 + Task 2 → ${XP_MANUAL_UNIT * 2} XP`,
        note: "Cộng ngay khi nộp, không phải chờ thầy chấm."
      },
      {
        title: "Tự luyện Nghe ẩn thanh audio",
        reward: `+${Math.round((XP_HIDDEN_AUDIO_FACTOR - 1) * 100)}% XP`,
        example: `VD: ${exampleUnitXp} XP → ${Math.floor(exampleUnitXp * XP_HIDDEN_AUDIO_FACTOR)} XP`,
        note: "Tích ô \"Ẩn thanh audio\" khi mở đề Nghe — audio phát một lượt như thi thật."
      },
      {
        title: "Chỉ tính lượt đầu",
        reward: "1 lần / phần",
        example: "Làm lại, tự luyện lại phần đã làm không cộng thêm",
        note: "Để hạng phản ánh công sức thật, không phải số lần bấm làm lại."
      }
    ]
  },
  {
    title: "Từ vựng (Sổ từ)",
    description: "Ôn thẻ đều mỗi ngày — ít mà đều vẫn leo hạng.",
    rules: [
      {
        title: "Ôn thẻ Sổ từ",
        reward: `1 XP / ${XP_VOCAB_CARDS_PER_POINT} thẻ`,
        example: `VD: ôn 20 thẻ → ${Math.min(XP_VOCAB_DAILY_CAP, Math.floor(20 / XP_VOCAB_CARDS_PER_POINT))} XP`,
        note: `Tối đa ${XP_VOCAB_DAILY_CAP} XP mỗi ngày.`
      }
    ]
  },
  {
    title: "XP và Xu",
    description: "Kiếm XP là kiếm Xu — tiêu Xu không làm tụt hạng.",
    rules: [
      {
        title: "Mỗi XP kiếm được",
        reward: `+${COINS_PER_XP} Xu`,
        example: "Đổi nền, khung, linh vật, quà ở Cửa hàng",
        note: "Mua đồ / cứu chuỗi / đổi quà trừ Xu nhưng XP và hạng giữ nguyên."
      }
    ]
  }
];

export default async function StudentRanksPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!student) {
    redirect("/waiting");
  }

  const progress = getXpProgress(await getLifetimeXp(student.id));
  const { current, next, xpToNext, percent } = progress;

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-3">
        <Link
          href="/student/ranking"
          aria-label="Về bảng xếp hạng"
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          ‹
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Hệ thống Hạng đấu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {XP_RANKS.length} hạng · {TOTAL_LEVELS} cấp · Tích XP qua mỗi bài làm và mỗi lần ôn từ để leo hạng — XP
            không bao giờ bị trừ.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-4 sm:flex-1">
          <RankMedal rankKey={current.rank.key} level={current.levelIndex} className="h-20 w-20 shrink-0 drop-shadow-xl sm:h-24 sm:w-24" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bạn đang ở</p>
            <p className={`text-3xl font-extrabold ${current.rank.textClass}`}>{levelName(current)}</p>
            <p className="mt-0.5 text-sm">
              Tổng <span className="font-semibold tabular-nums">{xpFormat.format(progress.xp)}</span> XP
            </p>
          </div>
        </div>
        <div className="sm:w-[45%]">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{next ? `Tiến trình lên ${levelName(next)}` : "Cấp cao nhất"}</span>
            <span className="tabular-nums text-muted-foreground">{Math.floor(percent)}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {xpToNext !== null ? `Còn ${xpFormat.format(xpToNext)} XP nữa.` : "Bạn đã chinh phục toàn bộ hạng đấu! 👑"}
          </p>
        </div>
      </section>

      <RankExplorer progress={progress} />

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-xl font-bold">Cách kiếm XP</h3>
          <Link href="/student/practice" className="text-sm font-semibold text-primary hover:underline">
            Đi luyện tập →
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          {EARN_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
              <p className="text-sm font-bold uppercase tracking-wide">{group.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {group.rules.map((rule) => (
                  <div key={rule.title} className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{rule.title}</p>
                      <span className="rounded-full bg-lime-400/20 px-2 py-0.5 text-xs font-bold text-lime-700 dark:text-lime-300">
                        {rule.reward}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{rule.example}</p>
                    {rule.note ? <p className="mt-1 text-xs text-muted-foreground">{rule.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ngưỡng XP có thể được thầy điều chỉnh để cân bằng hệ thống. Bảng xếp hạng lớp vẫn xếp theo điểm xếp hạng (chất
          lượng bài làm); hạng đấu chỉ đo công sức tích luỹ.
        </p>
      </section>
    </div>
  );
}
