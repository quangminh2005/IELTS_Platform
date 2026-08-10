// Neon tự cho compute ngủ sau vài phút không ai dùng. Cron nhắc bài chạy 12h trưa
// VN — giờ đó thường không có ai vào web, nên request đầu tiên hay chết vì DB chưa
// kịp thức ("Can't reach database server"). Thay vì bỏ cuộc ngay, thử lại vài lần
// cách nhau vài giây: Neon thường tỉnh trong khoảng đó.

export const WARMUP_ATTEMPTS = 4;
export const WARMUP_DELAY_MS = 2000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type WarmUpOptions = {
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Gọi `ping` cho tới khi thành công. Trả về số lần đã thử (1 = thành công ngay).
 * Thử hết số lần cho phép mà vẫn lỗi thì ném lại lỗi cuối cùng.
 */
export async function warmUpDatabase(
  ping: () => Promise<unknown>,
  options: WarmUpOptions = {}
): Promise<number> {
  const attempts = Math.max(1, options.attempts ?? WARMUP_ATTEMPTS);
  const delayMs = options.delayMs ?? WARMUP_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await ping();
      return attempt;
    } catch (error) {
      lastError = error;

      // Lần cuối thì khỏi chờ thêm, ném lỗi luôn.
      if (attempt < attempts) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}
