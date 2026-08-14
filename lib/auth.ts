import * as bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import {
  clientIpFromHeaders,
  lockFromFailures,
  LOGIN_LOCKED_ERROR,
  LOGIN_WINDOW_MINUTES,
  MAX_FAILS_PER_EMAIL,
  MAX_FAILS_PER_IP
} from "./login-lock";
import { prisma } from "./prisma";

type AppUser = NextAuthUser & {
  role: string;
};

function toAppUser(user: {
  id: string;
  name: string | null;
  email: string;
  role: string;
}): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

/**
 * Số lần đăng nhập sai còn trong cửa sổ, theo email và theo IP.
 *
 * `take` chặn trên số dòng đọc về đúng bằng ngưỡng khoá: đủ để biết "đã chạm
 * ngưỡng chưa" và lần sai cũ nhất là lúc nào, mà kẻ dò mật khẩu có tạo ra hàng
 * vạn bản ghi cũng không làm truy vấn này phình ra.
 */
async function recentLoginFailures(email: string, ip: string, since: Date) {
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { email, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: MAX_FAILS_PER_EMAIL,
      select: { createdAt: true }
    }),
    prisma.loginAttempt.findMany({
      where: { ip, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      take: MAX_FAILS_PER_IP,
      select: { createdAt: true }
    })
  ]);

  return {
    email: byEmail.map((row) => row.createdAt),
    ip: byIp.map((row) => row.createdAt)
  };
}

async function recordLoginFailure(email: string, ip: string, since: Date) {
  try {
    await prisma.loginAttempt.create({ data: { email, ip } });
    // Dọn luôn bản ghi đã hết hạn — bảng này không bao giờ được phép phình to.
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: since } } });
  } catch {
    // Ghi nhận thất bại thì thôi, tuyệt đối không làm hỏng luồng đăng nhập.
  }
}

async function clearLoginFailures(email: string) {
  try {
    await prisma.loginAttempt.deleteMany({ where: { email } });
  } catch {
    // Như trên.
  }
}

/**
 * Đăng nhập bằng email + mật khẩu.
 *
 * Hai chốt chặn ở đây:
 * 1. CHỈ giáo viên được dùng mật khẩu. Học viên bắt buộc đăng nhập bằng Google
 *    (xem callback `signIn`) — nếu một tài khoản học viên vì lý do nào đó có
 *    `passwordHash` thì đây sẽ là cổng đi vòng qua quy định đó.
 * 2. Sai quá nhiều lần thì khoá tạm theo email + IP, để không ai ngồi dò mật
 *    khẩu được. Ném lỗi (không trả null) vì NextAuth chỉ chuyển được thông điệp
 *    riêng ra trang đăng nhập qua đường ném lỗi.
 *
 * `headers` là headers của request đăng nhập, NextAuth truyền vào `authorize`.
 */
export async function authorizeCredentials(
  emailInput?: string,
  password?: string,
  headers?: Headers | Record<string, unknown> | null
) {
  const email = emailInput?.trim().toLowerCase();

  if (!email || !password) {
    return null;
  }

  const now = new Date();
  const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60_000);
  const ip = clientIpFromHeaders(headers);

  try {
    const failures = await recentLoginFailures(email, ip, since);
    const lock = lockFromFailures(failures.email, failures.ip, now);

    if (lock.locked) {
      throw new Error(`${LOGIN_LOCKED_ERROR}:${lock.minutes}`);
    }
  } catch (error) {
    // Đang bị khoá thì ném tiếp. Còn nếu chính truy vấn đếm bị lỗi (Neon ngủ,
    // mất kết nối) thì cho đi tiếp: thà chịu rủi ro dò mật khẩu trong lúc DB
    // trục trặc còn hơn khoá cứng tài khoản giáo viên duy nhất ra khỏi lớp.
    if (error instanceof Error && error.message.startsWith(LOGIN_LOCKED_ERROR)) {
      throw error;
    }
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user?.passwordHash || user.role !== "teacher") {
    await recordLoginFailure(email, ip, since);
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    await recordLoginFailure(email, ip, since);
    return null;
  }

  await clearLoginFailures(email);

  return toAppUser(user);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Teacher credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        return authorizeCredentials(credentials?.email, credentials?.password, req?.headers);
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = user.email?.trim().toLowerCase();

      if (!email) {
        return "/waiting";
      }

      const studentProfile = await prisma.studentProfile.findUnique({
        where: { email }
      });

      if (!studentProfile) {
        return "/waiting";
      }

      // Ảnh đại diện Google (nếu có) để hiển thị avatar học viên. Chỉ ghi đè khi
      // Google trả về ảnh, tránh xoá ảnh cũ nếu lần này không có.
      const googleImage = user.image ?? undefined;

      const appUser = await prisma.user.upsert({
        where: { email },
        // KHÔNG ghi đè `role` khi tài khoản đã tồn tại: trước đây mỗi lần đăng
        // nhập Google đều ép role = "student", nên một email giáo viên mà lỡ có
        // StudentProfile sẽ bị hạ quyền ngay lần đăng nhập kế tiếp. Chỉ tài
        // khoản TẠO MỚI qua cổng này mới mặc định là học viên.
        update: {
          googleId: account.providerAccountId,
          name: user.name ?? studentProfile.displayName,
          image: googleImage
        },
        create: {
          email,
          googleId: account.providerAccountId,
          name: user.name ?? studentProfile.displayName,
          image: googleImage,
          role: "student"
        }
      });

      await prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: { userId: appUser.id }
      });

      user.id = appUser.id;
      user.name = appUser.name;
      (user as AppUser).role = appUser.role;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as AppUser).role;
      }

      if ((!token.id || !token.role) && token.email) {
        const appUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            role: true
          }
        });

        if (appUser) {
          token.id = appUser.id;
          token.role = appUser.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }

      return session;
    }
  }
};

export function auth() {
  return getServerSession(authOptions);
}
