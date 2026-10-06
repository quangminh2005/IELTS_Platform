import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedCard } from "@/components/feed/feed-card";
import { auth } from "@/lib/auth";
import { FEED_PAGE_SIZE, FEED_WINDOW_DAYS, resolveFeedLimit } from "@/lib/feed";
import { getFeedPage } from "@/lib/feed-data";
import { prisma } from "@/lib/prisma";
import { friendScope } from "@/lib/social";
import { getFollowingIds } from "@/lib/social-data";

export const dynamic = "force-dynamic";

// Bảng tin hoạt động (Mạng xã hội Đợt 3, spec 2026-10-06-xa-hoi-dot-3): tab Bạn bè
// (mình + người mình theo dõi, mặc định) và Toàn trường. Hoạt động tự sinh từ việc
// học — không bao giờ hiện điểm, band hay số Xu.

type Scope = "friends" | "school";

function tabClass(active: boolean): string {
  return `rounded-lg px-4 py-2 text-center text-sm font-semibold transition ${
    active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
  }`;
}

export default async function StudentFeedPage({
  searchParams
}: {
  searchParams?: { scope?: string; limit?: string; focus?: string };
}) {
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

  const scope: Scope = searchParams?.scope === "school" ? "school" : "friends";
  const limit = resolveFeedLimit(searchParams?.limit);
  const focusKey = searchParams?.focus?.slice(0, 200) ?? null;
  const followingIds = scope === "friends" ? await getFollowingIds(student.id) : [];
  const noFriends = scope === "friends" && followingIds.length === 0;

  const page = await getFeedPage({
    viewerUserId: session.user.id,
    studentIds: scope === "friends" ? friendScope(student.id, followingIds) : null,
    limit,
    focusKey
  });

  const hrefOf = (next: { scope?: Scope; limit?: number }) => {
    const search = new URLSearchParams();
    const nextScope = next.scope ?? scope;
    if (nextScope === "school") search.set("scope", "school");
    if (next.limit && next.limit > FEED_PAGE_SIZE) search.set("limit", String(next.limit));
    const query = search.toString();
    return query ? `/student/feed?${query}` : "/student/feed";
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Mạng xã hội</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Bảng tin</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Hoạt động học tập trong {FEED_WINDOW_DAYS} ngày gần đây — thả tim, bình luận để cổ vũ nhau.
        </p>
      </header>

      <div className="mx-auto max-w-2xl space-y-4">
        <nav
          aria-label="Phạm vi bảng tin"
          className="inline-flex rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20"
        >
          <Link href={hrefOf({ scope: "friends" })} className={tabClass(scope === "friends")}>
            Bạn bè
          </Link>
          <Link href={hrefOf({ scope: "school" })} className={tabClass(scope === "school")}>
            Toàn trường
          </Link>
        </nav>

        {page.focusMissing ? (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-card">
            Hoạt động này đã cũ (quá {FEED_WINDOW_DAYS} ngày) nên không còn trên bảng tin.
          </p>
        ) : null}

        {noFriends ? (
          <div className="rounded-xl border border-border bg-card px-5 py-8 text-center shadow-card">
            <p className="text-sm font-medium">Bạn chưa theo dõi ai</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Theo dõi bạn bè để thấy hoạt động của các bạn ở đây.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm font-semibold">
              <Link href="/student/profile#ban-be" className="text-primary hover:underline">
                Tìm bạn →
              </Link>
              <Link href={hrefOf({ scope: "school" })} className="text-primary hover:underline">
                Xem Toàn trường →
              </Link>
            </div>
          </div>
        ) : null}

        {page.items.length === 0 && !noFriends ? (
          <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground shadow-card">
            Chưa có hoạt động nào trong {FEED_WINDOW_DAYS} ngày qua — nộp một bài để mở hàng nhé!
          </div>
        ) : null}

        {page.items.map((item) => (
          <FeedCard
            key={item.key}
            item={item}
            viewer={{ role: "student", studentId: student.id }}
            ownerHref={item.owner.studentId === student.id ? "/student/profile" : `/student/profile/${item.owner.studentId}`}
            initiallyOpen={item.key === focusKey}
          />
        ))}

        {page.hasMore ? (
          <div className="text-center">
            <Link
              href={hrefOf({ limit: limit + FEED_PAGE_SIZE })}
              scroll={false}
              className="inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold shadow-card transition hover:border-primary"
            >
              Xem thêm
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
