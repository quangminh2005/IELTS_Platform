"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";

type AppShellRole = "teacher" | "student";

type NavItem = { href: string; label: string; hint: string; icon: IconName };

const navByRole: Record<AppShellRole, NavItem[]> = {
  teacher: [
    { href: "/teacher", label: "Tổng quan", hint: "Bảng điều khiển", icon: "home" },
    { href: "/teacher/classes", label: "Lớp học", hint: "Quản lý học viên", icon: "users" },
    { href: "/teacher/ranking", label: "Xếp hạng", hint: "Bảng xếp hạng lớp", icon: "trophy" },
    { href: "/teacher/materials", label: "Tài liệu", hint: "Kho đề & bài", icon: "book" },
    { href: "/teacher/assignments", label: "Giao bài", hint: "Bài tập về nhà", icon: "clipboard" },
    { href: "/teacher/calendar", label: "Lịch giao bài", hint: "Theo dõi nộp bài", icon: "calendar" },
    { href: "/teacher/review", label: "Chấm bài", hint: "Writing & Speaking", icon: "check" }
  ],
  student: [
    { href: "/student", label: "Tổng quan", hint: "Bài được giao", icon: "home" },
    { href: "/student/history", label: "Lịch sử", hint: "Kết quả & bài đã làm", icon: "clock" },
    { href: "/student/stats", label: "Tiến bộ", hint: "Biểu đồ & điểm yếu", icon: "chart" },
    { href: "/student/ranking", label: "Xếp hạng", hint: "So với bạn cùng lớp", icon: "trophy" }
  ]
};

type IconName = "home" | "users" | "book" | "clipboard" | "check" | "clock" | "trophy" | "menu" | "close" | "calendar" | "chart";

function Icon({ name }: { name: IconName }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5 shrink-0"
  };

  switch (name) {
    case "home":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M21 20a5.5 5.5 0 0 0-4-5.3" />
        </svg>
      );
    case "book":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
          <path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5Z" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4a3 3 0 0 1 6 0" />
          <path d="M9 11h6M9 15h4" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 12.5 9 17.5 20 6.5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
          <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
          <path d="M12 13v4M9 21h6M10 17h4" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 19.5h16" />
          <path d="M5 15.5l4.5-4.5 3.5 3 5.5-6.5" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "close":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
  }
}

function Brand({ role }: { role: AppShellRole }) {
  return (
    <Link href={role === "teacher" ? "/teacher" : "/student"} className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-card">
        IE
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold">IELTS Platform</span>
        <span className="block text-[11px] font-medium text-muted-foreground">
          {role === "teacher" ? "Khu vực giáo viên" : "Khu vực học viên"}
        </span>
      </span>
    </Link>
  );
}

function useIsActive() {
  const pathname = usePathname();

  return (href: string, rootHref: string) => {
    if (href === rootHref) {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

function NavLinks({
  items,
  rootHref,
  onNavigate
}: {
  items: NavItem[];
  rootHref: string;
  onNavigate?: () => void;
}) {
  const isActive = useIsActive();

  return (
    <nav className="grid gap-1.5">
      {items.map((item) => {
        const active = isActive(item.href, rootHref);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-primary transition"
                : "flex items-center gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-foreground transition hover:border-border hover:bg-muted"
            }
          >
            <span className={active ? "text-primary" : "text-muted-foreground"}>
              <Icon name={item.icon} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, role }: { children: ReactNode; role: AppShellRole }) {
  const navItems = navByRole[role];
  const rootHref = role === "teacher" ? "/teacher" : "/student";
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Đóng drawer mỗi khi điều hướng sang trang khác.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Khoá cuộn nền khi drawer mở.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Trang kết quả chạy toàn màn hình như chin.edu.vn: bỏ sidebar + bỏ khung
  // max-w để dùng hết chiều ngang. Không bọc trong `animate-fade-in` vì lớp này
  // tạo transform → phá vỡ position:fixed của các overlay con bên trong trang.
  const isFullScreen = pathname.includes("/results/");
  if (isFullScreen) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  // Trang chấm bài chi tiết giữ menu điều hướng nhưng cần bề ngang tối đa: bài
  // luận + khung chấm + danh sách học sinh nằm cạnh nhau, bó trong max-w-5xl thì
  // cột đọc bài chỉ còn ~270px (hẹp hơn cả khung chấm).
  const isWidePage = /^\/teacher\/review\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-screen">
      {/* Thanh trên cùng cho điện thoại / máy tính bảng */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Mở menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:border-primary hover:text-primary"
        >
          <Icon name="menu" />
        </button>
        <Brand role={role} />
        <AnimatedThemeToggle />
      </header>

      <div className={`mx-auto flex w-full ${isWidePage ? "max-w-[1800px]" : "max-w-7xl"}`}>
        {/* Sidebar cố định cho màn hình lớn */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-border bg-card/60 px-4 py-5 backdrop-blur lg:flex">
          <div className="flex items-center justify-between gap-2">
            <Brand role={role} />
            <AnimatedThemeToggle />
          </div>

          <span className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">
            {role === "teacher" ? "Giáo viên" : "Học viên"}
          </span>

          <div className="mt-6 flex-1 overflow-y-auto">
            <NavLinks items={navItems} rootHref={rootHref} />
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <LogoutButton />
          </div>
        </aside>

        {/* Drawer điện thoại */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-card px-4 py-5 shadow-pop animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <Brand role={role} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Đóng menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition hover:border-primary hover:text-primary"
                >
                  <Icon name="close" />
                </button>
              </div>

              <span className="mt-5 inline-flex w-fit items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">
                {role === "teacher" ? "Giáo viên" : "Học viên"}
              </span>

              <div className="mt-6 flex-1 overflow-y-auto">
                <NavLinks
                  items={navItems}
                  rootHref={rootHref}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <LogoutButton />
              </div>
            </div>
          </div>
        ) : null}

        {/* Nội dung chính */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div
            className={`mx-auto w-full animate-fade-in ${isWidePage ? "" : "max-w-5xl"}`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
