import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // .claude/worktrees chứa bản sao repo của các phiên làm việc khác (nhánh khác).
    // Không chặn thì vitest quét luôn tests/ trong đó và một nhánh khác có thể làm
    // đỏ bộ test của nhánh này.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
  // tsconfig để jsx: "preserve" cho Next; test dựng component (vd thẻ chỉ tiêu tự luyện)
  // cần Vite tự dịch JSX theo runtime tự động của React.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
