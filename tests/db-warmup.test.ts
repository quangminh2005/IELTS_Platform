import { describe, expect, it, vi } from "vitest";
import { warmUpDatabase } from "../lib/db-warmup";

const noSleep = async () => {};

describe("warmUpDatabase", () => {
  it("gọi 1 lần khi DB đang thức", async () => {
    const ping = vi.fn().mockResolvedValue(undefined);

    await expect(warmUpDatabase(ping, { sleep: noSleep })).resolves.toBe(1);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("thử lại cho tới khi DB tỉnh", async () => {
    const ping = vi
      .fn()
      .mockRejectedValueOnce(new Error("Can't reach database server"))
      .mockRejectedValueOnce(new Error("Can't reach database server"))
      .mockResolvedValue(undefined);

    await expect(warmUpDatabase(ping, { sleep: noSleep })).resolves.toBe(3);
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it("ném lỗi cuối cùng khi hết lượt thử", async () => {
    const ping = vi.fn().mockRejectedValue(new Error("Can't reach database server"));

    await expect(
      warmUpDatabase(ping, { attempts: 3, sleep: noSleep })
    ).rejects.toThrow("Can't reach database server");
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it("chờ giữa các lần thử, nhưng không chờ sau lần cuối", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ping = vi.fn().mockRejectedValue(new Error("nope"));

    await expect(
      warmUpDatabase(ping, { attempts: 3, delayMs: 2000, sleep })
    ).rejects.toThrow("nope");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});
