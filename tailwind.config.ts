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
        }
      },
      animation: {
        "fade-in": "fade-in 0.35s ease both",
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
        "frame-ember": "frame-ember 2.6s ease-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
