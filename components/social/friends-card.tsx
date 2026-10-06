"use client";

import { useMemo, useState } from "react";
import { FollowButton } from "@/components/social/follow-button";
import { FollowLists, PersonRow } from "@/components/social/follow-lists";
import type { BoardPerson } from "@/lib/leaderboard";
import { searchStudents } from "@/lib/social";

// Thẻ "Bạn bè" ở hồ sơ của mình (Mạng xã hội Đợt 2): tìm bạn trong trường, gợi ý bạn
// cùng lớp, hai danh sách theo dõi. Danh bạ cả trường đã được server gửi sẵn (vài chục
// em) — lọc ngay trên máy, gõ "tuan" vẫn ra "Tuấn".
export function FriendsCard({
  meId,
  directory,
  suggestions,
  followingIds,
  following,
  followers
}: {
  meId: string;
  directory: BoardPerson[];
  suggestions: BoardPerson[];
  followingIds: string[];
  following: BoardPerson[];
  followers: BoardPerson[];
}) {
  const [query, setQuery] = useState("");
  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);
  const results = useMemo(() => searchStudents(directory, query), [directory, query]);
  const searching = query.trim().length > 0;

  return (
    <section id="ban-be" className="scroll-mt-20 rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bạn bè</p>

      <label className="mt-3 block">
        <span className="sr-only">Tìm bạn trong trường</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm bạn trong trường…"
          autoComplete="off"
          // 16px trên điện thoại để iOS không tự phóng to khi chạm vào ô.
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none transition focus:border-primary sm:text-sm"
        />
      </label>

      {searching ? (
        results.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Không tìm thấy bạn nào tên như vậy.</p>
        ) : (
          <ul className="mt-2">
            {results.map((person) => (
              <PersonRow
                key={person.studentId}
                person={person}
                meId={meId}
                action={
                  <FollowButton
                    targetId={person.studentId}
                    initialFollowing={followingSet.has(person.studentId)}
                    size="sm"
                  />
                }
              />
            ))}
          </ul>
        )
      ) : suggestions.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground">Bạn cùng lớp</p>
          <ul className="mt-1">
            {suggestions.map((person) => (
              <PersonRow
                key={person.studentId}
                person={person}
                meId={meId}
                action={<FollowButton targetId={person.studentId} initialFollowing={false} size="sm" />}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <FollowLists
          following={following}
          followers={followers}
          meId={meId}
          emptyFollowing="Theo dõi bạn bè để so tài trên tab Bạn bè ở trang Xếp hạng."
          emptyFollowers="Chưa có ai theo dõi bạn."
        />
      </div>
    </section>
  );
}
