import Link from "next/link";
import { RedemptionActions, RewardAdminList, type RewardAdminItem } from "@/components/reward-admin";
import { StudentAvatar } from "@/components/student-avatar";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_REDEMPTION_STATUSES,
  REDEMPTION_STATUS_CLASSES,
  REDEMPTION_STATUS_LABELS,
  isRedemptionStatus
} from "@/lib/rewards";
import { requireTeacherPage } from "@/lib/teacher-page";

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("vi-VN");
const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh"
});

const studentSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  avatarPreset: true,
  user: { select: { image: true } }
} as const;

// Đổi quà ngoài đời (Xu Đợt 3): phiếu chờ trao · món quà · lịch sử phiếu.
export default async function TeacherRewardsPage() {
  const teacher = await requireTeacherPage();
  const scope = { reward: { teacherId: teacher.id } };

  const [rewards, activeCounts, totalCounts, pending, history] = await Promise.all([
    prisma.reward.findMany({
      where: { teacherId: teacher.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { price: "asc" }, { createdAt: "asc" }]
    }),
    prisma.rewardRedemption.groupBy({
      by: ["rewardId"],
      where: { ...scope, status: { in: [...ACTIVE_REDEMPTION_STATUSES] } },
      _count: { _all: true }
    }),
    prisma.rewardRedemption.groupBy({ by: ["rewardId"], where: scope, _count: { _all: true } }),
    prisma.rewardRedemption.findMany({
      where: { ...scope, status: "pending" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        rewardName: true,
        rewardEmoji: true,
        price: true,
        createdAt: true,
        student: { select: studentSelect }
      }
    }),
    prisma.rewardRedemption.findMany({
      where: { ...scope, status: { not: "pending" } },
      orderBy: { resolvedAt: "desc" },
      take: 50,
      select: {
        id: true,
        rewardName: true,
        rewardEmoji: true,
        price: true,
        status: true,
        teacherNote: true,
        resolvedAt: true,
        createdAt: true,
        student: { select: { id: true, displayName: true } }
      }
    })
  ]);

  const activeByReward = new Map(activeCounts.map((row) => [row.rewardId, row._count._all]));
  const totalByReward = new Map(totalCounts.map((row) => [row.rewardId, row._count._all]));
  const adminItems: RewardAdminItem[] = rewards.map((reward) => ({
    id: reward.id,
    emoji: reward.emoji,
    imageUrl: reward.imageUrl,
    name: reward.name,
    description: reward.description,
    price: reward.price,
    stock: reward.stock,
    limitPerStudent: reward.limitPerStudent,
    limitPeriod: reward.limitPeriod,
    active: reward.active,
    activeCount: activeByReward.get(reward.id) ?? 0,
    totalRedemptions: totalByReward.get(reward.id) ?? 0
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Đổi quà</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Học viên đổi Xu lấy quà thật. Xu bị trừ ngay khi đổi; thầy trao quà rồi bấm “Đã trao”, hoặc từ chối để
          hoàn Xu.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-bold">
          Phiếu chờ trao <span className="text-sm font-normal text-muted-foreground">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Không có phiếu nào đang chờ.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {pending.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <StudentAvatar
                  avatarUrl={row.student.avatarUrl}
                  avatarPreset={row.student.avatarPreset}
                  userImage={row.student.user?.image ?? null}
                  displayName={row.student.displayName}
                  size="list"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/teacher/students/${row.student.id}`} className="text-sm font-semibold hover:underline">
                    {row.student.displayName}
                  </Link>
                  <p className="text-sm">
                    <span aria-hidden="true">{row.rewardEmoji}</span> {row.rewardName}
                    <span className="text-muted-foreground">
                      {" "}
                      · 🪙 {numberFormat.format(row.price)} · {dateTimeFormat.format(row.createdAt)}
                    </span>
                  </p>
                </div>
                <RedemptionActions redemptionId={row.id} price={row.price} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Món quà</h2>
        <RewardAdminList rewards={adminItems} />
      </section>

      {history.length > 0 ? (
        <section>
          <h2 className="text-lg font-bold">Lịch sử phiếu</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {history.map((row) => {
              const status = isRedemptionStatus(row.status) ? row.status : "pending";
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span aria-hidden="true">{row.rewardEmoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{row.student.displayName}</span> · {row.rewardName}
                    {row.teacherNote ? <span className="text-muted-foreground"> · {row.teacherNote}</span> : null}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${REDEMPTION_STATUS_CLASSES[status]}`}>
                    {REDEMPTION_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateTimeFormat.format(row.resolvedAt ?? row.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
