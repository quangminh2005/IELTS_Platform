import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        card: "hsl(var(--card))",
        ring: "hsl(var(--ring))"
      },
      borderRadius: {
        md: "calc(var(--radius) - 0.25rem)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 0.25rem)",
        "2xl": "calc(var(--radius) + 0.5rem)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        // Bảng "Chỉnh sửa hồ sơ" trượt vào từ mép phải.
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" }
        },
        // Bản chỉ đổi độ trong — dùng cho mảng nền, vì translateY sẽ kéo lệch cả lớp.
        "fade-in-soft": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        // ---- Hiệu ứng khung avatar (components/shop/frame-art.tsx) ----
        // Vệt sáng chạy một vòng quanh viền rồi nghỉ. 257.6 = chu vi vòng r=41.
        "frame-shine": {
          "0%": { "stroke-dashoffset": "0", opacity: "0" },
          "4%": { opacity: "1" },
          "32%": { opacity: "1" },
          "36%, 100%": { "stroke-dashoffset": "-257.6", opacity: "0" }
        },
        // Tia sao nhấp nháy: phóng to + xoay nhẹ rồi tắt.
        "frame-twinkle": {
          "0%, 100%": { opacity: "0.1", transform: "scale(0.35) rotate(0deg)" },
          "50%": { opacity: "1", transform: "scale(1) rotate(45deg)" }
        },
        // Cánh trái/phải khẽ nâng lên (góc ngược dấu vì cánh phải là bản lật).
        "frame-flap-l": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(6deg)" }
        },
        "frame-flap-r": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(-6deg)" }
        },
        // Hào quang toả nhịp.
        "frame-pulse": {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.75" }
        },
        // Ngọn lửa bập bùng (gốc ở đáy ngọn lửa).
        "frame-flicker": {
          "0%, 100%": { transform: "scale(1, 1)" },
          "30%": { transform: "scale(0.92, 1.14)" },
          "60%": { transform: "scale(1.05, 0.93)" }
        },
        // Tàn lửa bay lên rồi tắt.
        "frame-ember": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "15%": { opacity: "1" },
          "100%": { transform: "translateY(-16px)", opacity: "0" }
        },
        // ---- Linh vật (components/shop/mascot-art.tsx) — gốc xoay đặt ở từng phần tử ----
        // Nhún nhẹ cả người.
        "mascot-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" }
        },
        // Chớp mắt: gần như cả chu kỳ mở, nhắm rất nhanh.
        "mascot-blink": {
          "0%, 90%, 100%": { transform: "scaleY(1)" },
          "94%": { transform: "scaleY(0.1)" }
        },
        // Vẫy tay quanh vai.
        "mascot-wave": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(16deg)" },
          "50%": { transform: "rotate(-4deg)" },
          "75%": { transform: "rotate(16deg)" }
        },
        // Gật gù (đọc sách, phun lửa).
        "mascot-nod": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(3deg)" }
        },
        // Lật trang: tờ giấy gập qua gáy sách rồi nghỉ.
        "mascot-page": {
          "0%, 55%": { transform: "scaleX(1)", opacity: "0" },
          "60%": { opacity: "1" },
          "80%": { transform: "scaleX(-1)", opacity: "1" },
          "85%, 100%": { transform: "scaleX(-1)", opacity: "0" }
        },
        // Nhảy mừng có co giãn.
        "mascot-hop": {
          "0%, 100%": { transform: "translateY(0) scale(1.05, 0.95)" },
          "35%": { transform: "translateY(-14px) scale(0.96, 1.04)" },
          "65%": { transform: "translateY(0) scale(1.04, 0.96)" },
          "80%": { transform: "translateY(0) scale(1, 1)" }
        },
        // Ngủ: thở chậm.
        "mascot-breathe": {
          "0%, 100%": { transform: "scale(1, 1)" },
          "50%": { transform: "scale(1.03, 0.97)" }
        },
        // Chữ Z / nốt nhạc bay lên rồi tan.
        "mascot-float": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translate(8px, -22px)", opacity: "0" }
        },
        // Tua mũ tốt nghiệp đung đưa.
        "mascot-swing": {
          "0%, 100%": { transform: "rotate(-6deg)" },
          "50%": { transform: "rotate(8deg)" }
        },
        // Lắc lư theo nhạc.
        "mascot-sway": {
          "0%, 100%": { transform: "rotate(-5deg)" },
          "50%": { transform: "rotate(5deg)" }
        },
        // Kính lúp soi qua soi lại.
        "mascot-scan": {
          "0%, 100%": { transform: "rotate(-5deg)" },
          "50%": { transform: "rotate(6deg)" }
        },
        // Lửa phụt.
        "mascot-flame": {
          "0%, 100%": { transform: "scale(1, 1)" },
          "30%": { transform: "scale(1.08, 0.9)" },
          "60%": { transform: "scale(0.94, 1.08)" }
        },
        // Đập cánh (cánh phải là bản lật gương nên dùng chung).
        "mascot-flap": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(14deg)" }
        },
        // Ngoáy đuôi.
        "mascot-tail": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(-7deg)" }
        },
        // Nút cảm xúc trên hồ sơ (Mạng xã hội Đợt 2) nảy một nhịp khi bấm.
        "reaction-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)" },
          "100%": { transform: "scale(1)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.35s ease both",
        "drawer-in": "drawer-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in-soft": "fade-in-soft 0.9s ease both",
        // Vòng lửa khung "Phượng hoàng" ở Cửa hàng (keyframes spin có sẵn của Tailwind).
        "spin-slow": "spin 9s linear infinite",
        "spin-slower": "spin 24s linear infinite",
        "frame-shine": "frame-shine 4s ease-in-out infinite",
        "frame-twinkle": "frame-twinkle 2.4s ease-in-out infinite",
        "frame-flap-l": "frame-flap-l 3.2s ease-in-out infinite",
        "frame-flap-r": "frame-flap-r 3.2s ease-in-out infinite",
        "frame-pulse": "frame-pulse 2.8s ease-in-out infinite",
        "frame-flicker": "frame-flicker 1.3s ease-in-out infinite",
        "frame-ember": "frame-ember 2.6s ease-out infinite",
        "mascot-bob": "mascot-bob 3s ease-in-out infinite",
        "mascot-blink": "mascot-blink 4.5s ease-in-out infinite",
        "mascot-wave": "mascot-wave 1.6s ease-in-out infinite",
        "mascot-nod": "mascot-nod 3.2s ease-in-out infinite",
        "mascot-page": "mascot-page 4s ease-in-out infinite",
        "mascot-hop": "mascot-hop 1.1s ease-in-out infinite",
        "mascot-breathe": "mascot-breathe 3.6s ease-in-out infinite",
        "mascot-float": "mascot-float 2.7s ease-out infinite",
        "mascot-swing": "mascot-swing 2s ease-in-out infinite",
        "mascot-sway": "mascot-sway 1.2s ease-in-out infinite",
        "mascot-scan": "mascot-scan 2.6s ease-in-out infinite",
        "mascot-flame": "mascot-flame 0.6s ease-in-out infinite",
        "mascot-flap": "mascot-flap 1.8s ease-in-out infinite",
        "mascot-tail": "mascot-tail 2.4s ease-in-out infinite",
        "reaction-pop": "reaction-pop 0.45s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
