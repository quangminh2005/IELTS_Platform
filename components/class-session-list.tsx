"use client";

import { useState } from "react";
import { ClassSessionEditor, type EditableSession } from "@/components/class-session-editor";
import { SessionBadges } from "@/components/session-badges";
import { formatShortDate, formatVnTime, sessionNumberText } from "@/lib/class-schedule";

export type TeacherSessionRow = EditableSession & { number: number | null };

const UPCOMING_LIMIT = 8;

export function ClassSessionList({
  classId,
  sessions,
  total,
  nowIso,
  todayKey
}: {
  classId: string;
  sessions: TeacherSessionRow[];
  total: number | null;
  nowIso: string;
  todayKey: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<TeacherSessionRow | "new" | null>(null);
  const nowMs = new Date(nowIso).getTime();
  const upcoming = sessions.filter((session) => new Date(session.endsAt).getTime() > nowMs);
  const past = sessions.filter((session) => new Date(session.endsAt).getTime() <= nowMs).reverse();
  const visible = showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h4 className="text-sm font-semibold">Các buổi học</h4>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-primary transition hover:border-primary"
        >
          + Thêm buổi
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Chưa có buổi nào. Đặt lịch cố định ở khung bên cạnh hoặc bấm “+ Thêm buổi”.
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <ul className="divide-y divide-border">
          {visible.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              total={total}
              onEdit={() => setEditing(session)}
            />
          ))}
        </ul>
      ) : null}

      {upcoming.length > UPCOMING_LIMIT ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="w-full border-t border-border px-5 py-3 text-sm font-semibold text-primary hover:bg-muted"
        >
          {showAll ? "Thu gọn" : `Xem thêm ${upcoming.length - UPCOMING_LIMIT} buổi`}
        </button>
      ) : null}

      {past.length > 0 ? (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-muted-foreground">
            Đã qua ({past.length} buổi)
          </summary>
          <ul className="divide-y divide-border">
            {past.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                total={total}
                onEdit={() => setEditing(session)}
              />
            ))}
          </ul>
        </details>
      ) : null}

      {editing ? (
        <ClassSessionEditor
          classId={classId}
          session={editing === "new" ? null : editing}
          todayKey={todayKey}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function SessionRow({
  session,
  total,
  onEdit
}: {
  session: TeacherSessionRow;
  total: number | null;
  onEdit: () => void;
}) {
  const startsAt = new Date(session.startsAt);
  const endsAt = new Date(session.endsAt);
  const cancelled = session.status === "cancelled";
  const numberText = sessionNumberText(session.number, total);

  return (
    <li className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${cancelled ? "text-muted-foreground line-through" : ""}`}>
          {formatShortDate(startsAt)} · {formatVnTime(startsAt)}–{formatVnTime(endsAt)}
          {numberText ? ` · ${numberText}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <SessionBadges status={session.status} mode={session.mode} kind={session.kind} />
        </div>
        {session.note ? <p className="mt-1 truncate text-xs text-muted-foreground">{session.note}</p> : null}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
      >
        Sửa
      </button>
    </li>
  );
}
