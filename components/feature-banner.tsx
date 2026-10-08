"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { MascotArt } from "@/components/shop/mascot-art";
import { BANNER_THEMES, type FeatureAnnouncement } from "@/lib/feature-announcements";

// Banner "✦ TÍNH NĂNG MỚI" kiểu khối "Marketing TV" của chin.edu.vn. Danh sách slide
// do trang lọc sẵn bằng activeAnnouncements (lib/feature-announcements.ts).
//
// Tự chuyển: gạch tiến độ của slide đang hiện chạy animate-banner-progress (7s), hết
// animation thì sang slide sau. Tạm dừng = animation-play-state paused, nên rê chuột
// / bấm nút dừng / tab ẩn đều giữ nguyên vị trí gạch. Máy bật "giảm chuyển động" thì
// animation không chạy (motion-safe) → không tự chuyển, gạch hiện đầy.
//
// Các slide xếp chồng cùng một ô grid để khung cao theo slide cao nhất — không phải
// đoán chiều cao cố định khi chữ xuống dòng trên điện thoại.

const SWIPE_MIN_PX = 40;

export function FeatureBanner({ slides }: { slides: FeatureAnnouncement[] }) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  // Đổi mỗi lần chọn slide bằng tay để gạch tiến độ chạy lại từ đầu dù vẫn cùng index.
  const [cycle, setCycle] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const count = slides.length;
  const many = count > 1;
  const paused = userPaused || hovered || tabHidden;

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
      setCycle((value) => value + 1);
    },
    [count]
  );

  if (count === 0) return null;

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || !many) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Chỉ tính vuốt ngang rõ ràng — vuốt dọc là học viên đang cuộn trang.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
    goTo(dx < 0 ? index + 1 : index - 1);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Tính năng mới"
      className="relative overflow-hidden rounded-2xl text-white shadow-pop"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="grid">
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          const theme = BANNER_THEMES[slide.theme];
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} trên ${count}: ${slide.title.join(" ")}`}
              aria-hidden={!active}
              className={`relative flex min-h-[200px] flex-col justify-between gap-4 px-5 pb-4 pt-5 transition-[opacity,visibility] duration-500 [grid-area:1/1] sm:min-h-[280px] sm:px-8 sm:pb-6 sm:pt-7 ${
                active ? "visible opacity-100" : "invisible opacity-0"
              }`}
              style={{ background: theme.background }}
            >
              {/* Lớp tối phía chữ: điện thoại chữ bên trái, máy tính chữ bên phải. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,10,21,0.72),rgba(3,10,21,0)_78%)] sm:bg-[linear-gradient(90deg,rgba(3,10,21,0)_34%,rgba(3,10,21,0.55)_60%,rgba(3,10,21,0.85))]"
              />
              {/* Máy tính: linh vật đứng trên dãy nút điều khiển (bottom-16), không đè lên nhau. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-1 top-4 h-24 w-24 sm:bottom-16 sm:left-8 sm:right-auto sm:top-auto sm:h-48 sm:w-48 lg:left-12 lg:h-52 lg:w-52"
              >
                <MascotArt mascot={slide.mascot} pose={slide.pose} still={!active} className="h-full w-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]" />
              </div>

              <div className="relative pr-24 sm:ml-auto sm:max-w-sm sm:pr-0 sm:text-right md:max-w-md lg:max-w-lg">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.14em] sm:text-xs"
                  style={{ color: theme.accent }}
                >
                  <span aria-hidden="true">✦ </span>Tính năng mới
                </p>
                <h3 className="mt-1.5 text-xl font-extrabold leading-tight tracking-tight sm:mt-2 sm:text-3xl lg:text-4xl">
                  {slide.title[0]}
                  <br />
                  {slide.title[1]}
                </h3>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/80 sm:mt-3 sm:text-sm sm:leading-6">
                  {slide.description}
                </p>
              </div>

              <div className="relative flex items-end justify-end">
                <Link
                  href={slide.href}
                  tabIndex={active ? undefined : -1}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-slate-950 shadow-card transition hover:brightness-110"
                  style={{ background: theme.accent }}
                >
                  {slide.cta}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {many ? (
        // Điều khiển nằm cùng hàng với nút, góc dưới bên trái — đè lên slide.
        <div className="absolute bottom-4 left-5 flex items-center gap-1.5 sm:bottom-6 sm:left-8 sm:gap-2">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Tính năng trước"
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg leading-none transition hover:bg-white/20 sm:inline-flex"
          >
            ‹
          </button>
          <div role="tablist" aria-label="Chọn tính năng" className="flex items-center gap-1.5">
            {slides.map((slide, slideIndex) => {
              const active = slideIndex === index;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Xem ${slide.title.join(" ")}`}
                  onClick={() => goTo(slideIndex)}
                  className="flex h-6 items-center"
                >
                  <span className="relative block h-1 w-4 overflow-hidden rounded-full bg-white/25 sm:w-8">
                    {active ? (
                      <span
                        key={cycle}
                        className="absolute inset-0 origin-left rounded-full bg-white motion-safe:animate-banner-progress"
                        style={{ animationPlayState: paused ? "paused" : "running" }}
                        onAnimationEnd={() => goTo(index + 1)}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Tính năng tiếp theo"
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg leading-none transition hover:bg-white/20 sm:inline-flex"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setUserPaused((value) => !value)}
            aria-label={userPaused ? "Tiếp tục tự chuyển" : "Tạm dừng tự chuyển"}
            aria-pressed={userPaused}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs text-white/80 transition hover:bg-white/15 sm:h-8 sm:w-8"
          >
            {userPaused ? "▶" : "❚❚"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
