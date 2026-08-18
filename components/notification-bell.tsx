"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { markNotificationsRead } from "@/lib/actions/notifications";
import {
  NotificationEmpty,
  NotificationRow,
  type NotificationFeedItem
} from "@/components/notification-list";

const POLL_MS = 60_000;
const PANEL_LIMIT = 8;

export function NotificationBell() {
  const pathname = usePathname();
  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Mục đang chưa đọc lúc mở chuông: giữ dấu "mới" cho tới khi tải lại trang, để
  // học viên không mất dấu thứ vừa bấm vào xem.
  const stickyUnread = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/student/notifications", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        items?: NotificationFeedItem[];
        unreadCount?: number;
      };

      setItems(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      // Mất mạng: giữ nguyên số cũ, 60 giây nữa thử lại.
    }
  }, []);

  // Tải lại mỗi khi chuyển trang — layout của Next không dựng lại khi điều hướng
  // nên chuông phải tự làm việc này.
  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      // Tab bị ẩn thì thôi, đỡ đánh thức Neon vô ích.
      if (document.visibilityState === "visible") {
        void load();
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);

    if (!next || unreadCount === 0) {
      return;
    }

    for (const item of items) {
      if (item.unread) {
        stickyUnread.current.add(item.id);
      }
    }

    setUnreadCount(0);
    // Lỗi thì bỏ qua: lần mở chuông sau sẽ thử lại.
    void markNotificationsRead().catch(() => {});
  }

  const panelItems = items.slice(0, PANEL_LIMIT).map((item) => ({
    ...item,
    unread: item.unread || stickyUnread.current.has(item.id)
  }));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo"}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:border-primary hover:text-primary"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
          <path d="M10.5 19a2 2 0 0 0 3 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-2 shadow-pop">
          <p className="px-3 pb-2 pt-1 text-sm font-semibold">Thông báo</p>

          {panelItems.length > 0 ? (
            <div className="grid max-h-80 gap-1 overflow-y-auto">
              {panelItems.map((item) => (
                <NotificationRow key={item.id} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          ) : (
            <NotificationEmpty />
          )}

          <Link
            href="/student/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-lg px-3 py-2 text-center text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            Xem tất cả
          </Link>
        </div>
      ) : null}
    </div>
  );
}
