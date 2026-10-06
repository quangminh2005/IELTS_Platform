import type { CSSProperties, ReactNode } from "react";

// Hình nền bìa hồ sơ của Cửa hàng (lib/shop-catalog.ts). Nền bán trong Cửa hàng đều là
// tranh danh hoạ đã hết bản quyền (file tĩnh trong public/shop, ~100–380KB, phục vụ qua
// CDN của Vercel — KHÔNG qua Blob). Cùng một tranh phải đẹp ở hai khổ rất khác nhau:
//   - bìa hồ sơ máy tính ≈ 7,5:1 → chỉ thấy một dải ngang mỏng;
//   - thẻ Cửa hàng 16:10 và bìa hồ sơ điện thoại ≈ 2,7:1 → thấy gần trọn tranh.
// Vì vậy mỗi tranh có position riêng (object-position) neo dải ngang vào chi tiết đẹp nhất
// (trăng, mặt trời, con sóng…). sky là màu nền lúc ảnh chưa tải xong.
//
// fit="contain" (bìa trang hồ sơ, kiểu chin.edu.vn): hiện TRỌN tranh, không cắt; phần thừa
// hai bên lấp bằng chính bức tranh phóng to + làm mờ. position chỉ áp dụng cho fit="cover".
//
// Nền thành tích (bg:diligent) vẫn vẽ SVG viewBox 800×140 phủ kín (slice): chi tiết chính
// đặt ở GIỮA, trong y 20–120. LUẬT: không thẻ defs, không id, không gradient SVG
// (xem components/shop/frame-art.tsx).

const W = 800;
const H = 140;

type Scene =
  | { sky: CSSProperties["backgroundImage"]; draw: () => ReactNode }
  | { sky: CSSProperties["backgroundImage"]; image: { src: string; position: string } };

function painting(file: string, position: string, sky: string): Scene {
  return { sky: `linear-gradient(${sky}, ${sky})`, image: { src: `/shop/${file}.webp`, position } };
}

const ART: Record<string, Scene> = {
  "bg:starry-night": painting("moonlit-dnieper-kuindzhi", "50% 12%", "#1e2a4a"),
  "bg:meadow": painting("poppy-field-monet", "50% 60%", "#c9cfb8"),
  "bg:ocean": painting("cliff-pourville-monet", "50% 35%", "#7aa6c9"),
  "bg:pink-clouds": painting("almond-blossom-van-gogh", "50% 50%", "#7fb3c4"),
  "bg:sunset": painting("impression-sunrise-monet", "50% 33%", "#6f8a8a"),
  "bg:bamboo": painting("water-lilies-bridge-monet", "50% 40%", "#3f6b4a"),
  "bg:city-night": painting("starry-rhone-van-gogh", "50% 55%", "#1e3a6b"),
  "bg:aurora": painting("aurora-borealis-church", "50% 28%", "#2a2a26"),
  "bg:snow-peaks": painting("red-fuji-hokusai", "50% 35%", "#3a5a8a"),
  "bg:old-library": painting("view-of-delft-vermeer", "50% 70%", "#a9b4b8"),
  "bg:galaxy": painting("great-wave-hokusai", "50% 55%", "#e8dcc0"),
  // "Đêm đầy sao" (Van Gogh, 1889). Neo 15% để giữ trọn mặt trăng, xoáy mây và các vì sao.
  "bg:starry-van-gogh": painting("starry-night-van-gogh", "50% 15%", "#1e3a8a"),
  "bg:diligent": {
    sky: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)",
    draw: () => (
      <>
        <g fill="#ffffff" opacity="0.22">
          {Array.from({ length: 16 }, (_, index) => (
            <rect key={index} x="396" y="-330" width="8" height="400" transform={`rotate(${index * 22.5} 400 70)`} />
          ))}
        </g>
        <path d="M 384 92 L 376 126 L 390 119 L 398 130 L 400 96 Z" fill="#dc2626" />
        <path d="M 416 92 L 424 126 L 410 119 L 402 130 L 400 96 Z" fill="#b91c1c" />
        <circle cx="400" cy="68" r="30" fill="#fbbf24" stroke="#b45309" strokeWidth="4" />
        <path
          d="M 400 48 C 388 62, 386 76, 400 86 C 414 76, 412 62, 405 56 C 405 64, 402 68, 398 68 C 402 60, 402 54, 400 48 Z"
          fill="#ef4444"
        />
        <path d="M 400 66 C 394 72, 394 80, 400 84 C 406 80, 406 72, 400 66 Z" fill="#fde047" />
      </>
    )
  }
};

export function BackgroundArt({
  artKey,
  className = "",
  fit = "cover"
}: {
  artKey: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const scene = ART[artKey];

  if (!scene) {
    return null;
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: scene.sky }}
      aria-hidden="true"
    >
      {"image" in scene && fit === "contain" ? (
        <WholeImage src={scene.image.src} />
      ) : "image" in scene ? (
        // Ảnh tĩnh nhỏ (≤ ~380KB), không qua trình tối ưu ảnh của Next để khỏi tốn hạn mức.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={scene.image.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: scene.image.position }}
        />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          focusable="false"
          className="absolute inset-0 h-full w-full"
        >
          {scene.draw()}
        </svg>
      )}
    </div>
  );
}

// Ảnh hiện trọn trong khung: lớp dưới là chính ảnh phủ kín + làm mờ để lấp hai bên,
// lớp trên là ảnh object-contain. Dùng chung cho tranh Cửa hàng và ảnh nền tự tải.
export function WholeImage({ src, lazy = true }: { src: string; lazy?: boolean }) {
  const loading = lazy ? "lazy" : undefined;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading={loading}
        decoding="async"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-xl"
      />
      <div className="absolute inset-0 bg-black/25" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading={loading}
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain"
      />
    </>
  );
}
