// Logic thuần cho việc khoá tạm khi có người dò mật khẩu giáo viên.
//
// Tách khỏi lib/auth.ts để test được mà không cần database, VÀ để trang đăng
// nhập (client component) dùng chung được câu thông báo — file này cố tình
// KHÔNG import prisma, nếu không cả Prisma sẽ bị gói vào bundle trình duyệt.

// Cửa sổ trượt: chỉ đếm các lần sai trong 15 phút gần nhất.
export const LOGIN_WINDOW_MINUTES = 15;

// Sai quá ngần này lần trong cửa sổ thì khoá. Đếm theo email (chặn dò mật khẩu
// của một tài khoản) và theo IP (chặn kiểu rải nhiều email từ một máy).
export const MAX_FAILS_PER_EMAIL = 5;
export const MAX_FAILS_PER_IP = 20;

// Mã lỗi ném ra từ `authorize` của NextAuth. NextAuth v4 nhét thẳng
// `error.message` vào query string rồi trả về cho `signIn()` ở client, nên mã
// phải ngắn và không dấu; phần sau dấu ":" là số phút còn phải chờ.
export const LOGIN_LOCKED_ERROR = "TOO_MANY_LOGIN_ATTEMPTS";

type HeaderBag = Headers | Record<string, unknown> | null | undefined;

function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  // NextAuth truyền headers dạng object thường; API routes truyền Headers.
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }

  const value = (headers as Record<string, unknown>)[name];

  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
}

/**
 * IP của người đang đăng nhập.
 *
 * Trên Vercel `x-forwarded-for` do chính hạ tầng ghi đè (giá trị trình duyệt tự
 * gửi bị thay), nên tin được. Chuỗi có thể là "ip-thật, proxy1, proxy2" — lấy
 * phần tử đầu. Không đọc được thì trả "unknown": vẫn đếm được, chỉ là gộp chung.
 */
export function clientIpFromHeaders(headers: HeaderBag): string {
  const forwarded = readHeader(headers, "x-forwarded-for")?.split(",")[0]?.trim();

  if (forwarded) {
    return forwarded;
  }

  return readHeader(headers, "x-real-ip")?.trim() || "unknown";
}

/**
 * Còn bao nhiêu phút nữa mới hết khoá, tính từ lần sai CŨ NHẤT còn nằm trong
 * cửa sổ: khi lần đó trôi ra khỏi cửa sổ thì số lần sai tụt xuống dưới ngưỡng.
 *
 * Luôn trả ít nhất 1 để không bao giờ hiện "thử lại sau 0 phút".
 */
export function minutesUntilUnlock(oldestFailedAt: Date, now: Date): number {
  const unlockAt = oldestFailedAt.getTime() + LOGIN_WINDOW_MINUTES * 60_000;
  const remaining = Math.ceil((unlockAt - now.getTime()) / 60_000);

  return Math.max(1, remaining);
}

/**
 * Có đủ số lần sai để khoá chưa? `oldest` là lần sai cũ nhất còn trong cửa sổ,
 * dùng để tính thời điểm mở khoá.
 */
export function lockFromFailures(
  emailFailedAt: Date[],
  ipFailedAt: Date[],
  now: Date
): { locked: boolean; minutes: number } {
  const oldest =
    emailFailedAt.length >= MAX_FAILS_PER_EMAIL
      ? emailFailedAt[0]
      : ipFailedAt.length >= MAX_FAILS_PER_IP
        ? ipFailedAt[0]
        : null;

  if (!oldest) {
    return { locked: false, minutes: 0 };
  }

  return { locked: true, minutes: minutesUntilUnlock(oldest, now) };
}

/**
 * Đổi mã lỗi NextAuth trả về thành câu tiếng Việt hiện trên trang đăng nhập.
 *
 * Mọi lỗi khác đều gộp về "email hoặc mật khẩu không đúng" — cố tình không nói
 * rõ email có tồn tại hay không.
 */
export function loginErrorMessage(error: string): string {
  if (!error.startsWith(LOGIN_LOCKED_ERROR)) {
    return "Email hoặc mật khẩu không đúng.";
  }

  const minutes = Number(error.split(":")[1]);
  const wait = Number.isFinite(minutes) && minutes > 0 ? minutes : LOGIN_WINDOW_MINUTES;

  return `Sai mật khẩu quá nhiều lần. Bạn thử lại sau ${wait} phút nhé.`;
}
