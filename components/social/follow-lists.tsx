"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StudentAvatar } from "@/components/student-avatar";
import type { BoardPerson } from "@/lib/leaderboard";

// Hai tab "Đang theo dõi / Người theo dõi" (Mạng xã hội Đợt 2) — dùng ở thẻ Bạn bè
// của hồ sơ mình và thẻ danh sách trên hồ sơ bạn khác.

export function PersonRow({
  person,
  meId,
  action
}: {
  person: BoardPerson;
  meId: string;
  action?: ReactNode;
}) {
  const href = person.studentId === meId ? "/student/profile" : `/student/profile/${person.studentId}`;

  return (
    // px-1: khung avatar (Cửa hàng) to hơn avatar một chút, không để tràn mép thẻ.
    <li className="flex items-center gap-3 px-1 py-1.5">
      <StudentAvatar
        avatarUrl={person.avatarUrl}
        avatarPreset={person.avatarPreset}
        userImage={person.userImage}
        frame={person.equippedFrame ?? null}
        displayName={person.displayName}
        size="sm"
      />
      <Link href={href} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline">
        {person.displayName}
      </Link>
      {action}
    </li>
  );
}

function tabClass(active: boolean): string {
  return `rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition ${
    active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
  }`;
}

export function FollowLists({
  following,
  followers,
  meId,
  emptyFollowing,
  emptyFollowers
}: {
  following: BoardPerson[];
  followers: BoardPerson[];
  meId: string;
  emptyFollowing: string;
  emptyFollowers: string;
}) {
  const [tab, setTab] = useState<"following" | "followers">("following");
  const list = tab === "following" ? following : followers;
  const empty = tab === "following" ? emptyFollowing : emptyFollowers;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Danh sách theo dõi"
        className="grid grid-cols-2 rounded-xl border border-border bg-border/30 p-1 dark:bg-border/20"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "following"}
          onClick={() => setTab("following")}
          className={tabClass(tab === "following")}
        >
          Đang theo dõi ({following.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "followers"}
          onClick={() => setTab("followers")}
          className={tabClass(tab === "followers")}
        >
          Người theo dõi ({followers.length})
        </button>
      </div>

      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-80 overflow-y-auto pr-1">
          {list.map((person) => (
            <PersonRow key={person.studentId} person={person} meId={meId} />
          ))}
        </ul>
      )}
    </div>
  );
}

// Thẻ danh sách trên hồ sơ bạn khác (chỉ xem).
export function FollowListsCard({
  ownerName,
  following,
  followers,
  meId
}: {
  ownerName: string;
  following: BoardPerson[];
  followers: BoardPerson[];
  meId: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="mb-3 truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Bạn bè của {ownerName}
      </p>
      <FollowLists
        following={following}
        followers={followers}
        meId={meId}
        emptyFollowing="Chưa theo dõi ai."
        emptyFollowers="Chưa có ai theo dõi."
      />
    </section>
  );
}
