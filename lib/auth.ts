import * as bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
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

export async function authorizeCredentials(emailInput?: string, password?: string) {
  const email = emailInput?.trim().toLowerCase();

  if (!email || !password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user?.passwordHash) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    return null;
  }

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
      async authorize(credentials) {
        return authorizeCredentials(credentials?.email, credentials?.password);
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
        update: {
          googleId: account.providerAccountId,
          name: user.name ?? studentProfile.displayName,
          image: googleImage,
          role: "student"
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
