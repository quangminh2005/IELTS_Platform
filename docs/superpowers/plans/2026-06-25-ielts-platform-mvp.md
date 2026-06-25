# IELTS Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP IELTS platform where teachers input materials, assign flexible IELTS units to students, and students complete, review, and receive feedback on work.

**Architecture:** Use Next.js App Router with server actions for dashboard workflows, Prisma for persistence, and focused route groups for teacher/student surfaces. Build a vertical slice at a time: app shell, data model, auth, teacher content, assignment, student attempt, grading, review, history, and ranking.

**Tech Stack:** Next.js, TypeScript, Prisma, SQLite, Tailwind CSS, Auth.js/NextAuth-style auth, Vitest, Playwright.

---

## File Structure

Create this structure from an empty `E:\web_ielts` workspace:

```text
app/
  (auth)/
    login/page.tsx
    waiting/page.tsx
  teacher/
    layout.tsx
    page.tsx
    classes/page.tsx
    materials/page.tsx
    assignments/page.tsx
    review/page.tsx
    students/[studentId]/page.tsx
  student/
    layout.tsx
    page.tsx
    assignments/[recipientId]/page.tsx
    results/[attemptId]/page.tsx
    history/page.tsx
    ranking/page.tsx
  api/auth/[...nextauth]/route.ts
components/
  app-shell.tsx
  assignment-builder.tsx
  attempt-workspace.tsx
  highlight-layer.tsx
  material-editor.tsx
  result-review.tsx
  review-form.tsx
lib/
  actions/
    assignments.ts
    attempts.ts
    classes.ts
    materials.ts
    reviews.ts
  auth.ts
  grading.ts
  prisma.ts
  ranking.ts
  seed-data.ts
prisma/
  schema.prisma
  seed.ts
tests/
  grading.test.ts
  ranking.test.ts
  e2e/teacher-student-flow.spec.ts
```

Boundaries:

- `lib/grading.ts` owns auto-grading and answer normalization.
- `lib/ranking.ts` owns class ranking calculation.
- `lib/actions/*` owns server-side mutations and authorization checks.
- `components/*` owns reusable UI behaviors.
- `app/teacher/*` and `app/student/*` own role-specific pages.

## Task 1: Bootstrap Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git and project metadata**

Run:

```powershell
git init
```

Expected: Git creates `.git/`.

Create `package.json`:

```json
{
  "name": "web-ielts",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@auth/prisma-adapter": "latest",
    "@prisma/client": "latest",
    "bcryptjs": "latest",
    "next": "latest",
    "next-auth": "latest",
    "react": "latest",
    "react-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@types/bcryptjs": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "postcss": "latest",
    "prisma": "latest",
    "tailwindcss": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
pnpm install
```

Expected: dependencies install and `pnpm-lock.yaml` is created.

- [ ] **Step 3: Add base config files**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

Create `.gitignore`:

```gitignore
.next/
node_modules/
.env
.env.local
prisma/dev.db
prisma/dev.db-journal
.superpowers/
test-results/
playwright-report/
```

- [ ] **Step 4: Add app shell styles**

Create `app/layout.tsx`:

```tsx
import "./globals.css";

export const metadata = {
  title: "IELTS Platform",
  description: "Teacher and student IELTS learning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --bg: #0b1117;
  --panel: #111a24;
  --panel-2: #172232;
  --text: #edf3f8;
  --muted: #9fb0c2;
  --lime: #b7e42f;
  --blue: #4c6fff;
  --red: #ff6767;
  --green: #55d987;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}

button, input, textarea, select {
  font: inherit;
}
```

- [ ] **Step 5: Verify bootstrap**

Run:

```powershell
pnpm build
```

Expected: Next.js builds or reports only missing Tailwind config if Tailwind init has not run. If Tailwind config is missing, run:

```powershell
pnpm exec tailwindcss init -p
```

Then rerun `pnpm build`.

## Task 2: Prisma Schema And Seed Data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Create: `lib/prisma.ts`
- Create: `lib/seed-data.ts`

- [ ] **Step 1: Write Prisma schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  teacher
  student
}

enum Skill {
  listening
  reading
  writing
  speaking
}

enum UnitType {
  listening_part
  reading_passage
  writing_task
  speaking_part
}

enum AssignmentMode {
  homework
  practice
  mock_test
}

enum RecipientStatus {
  assigned
  in_progress
  submitted
  reviewed
}

enum SubmitReason {
  manual
  auto_timeout
}

model User {
  id             String          @id @default(cuid())
  name           String
  email          String          @unique
  role           Role
  passwordHash   String?
  googleId       String?         @unique
  teacherProfile TeacherProfile?
  studentProfile StudentProfile?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}

model TeacherProfile {
  id        String     @id @default(cuid())
  userId    String     @unique
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  classes   Class[]
  materials Material[]
  reviews   TeacherReview[]
}

model StudentProfile {
  id         String                @id @default(cuid())
  userId     String?               @unique
  user       User?                 @relation(fields: [userId], references: [id], onDelete: SetNull)
  displayName String
  email      String                @unique
  classes    ClassStudent[]
  recipients AssignmentRecipient[]
  attempts   Attempt[]
}

model Class {
  id          String         @id @default(cuid())
  teacherId   String
  teacher     TeacherProfile @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  name        String
  description String?
  students    ClassStudent[]
  createdAt   DateTime       @default(now())
}

model ClassStudent {
  id        String         @id @default(cuid())
  classId   String
  studentId String
  class     Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  student   StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  joinedAt  DateTime       @default(now())

  @@unique([classId, studentId])
}

model Material {
  id          String           @id @default(cuid())
  teacherId   String
  teacher     TeacherProfile   @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  skill       Skill
  title       String
  description String?
  sourceLabel String?
  units       AssignableUnit[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model AssignableUnit {
  id                      String           @id @default(cuid())
  materialId              String
  material                Material         @relation(fields: [materialId], references: [id], onDelete: Cascade)
  skill                   Skill
  unitType                UnitType
  unitNumber              Int
  title                   String
  instructions            String?
  content                 String?
  audioUrl                String?
  transcript              String?
  defaultTimeLimitMinutes Int?
  metadataJson            String?
  questions               Question[]
  assignmentUnits         AssignmentUnit[]
}

model Question {
  id               String         @id @default(cuid())
  assignableUnitId  String
  assignableUnit    AssignableUnit @relation(fields: [assignableUnitId], references: [id], onDelete: Cascade)
  order             Int
  questionType      String
  prompt            String
  optionsJson       String?
  correctAnswerJson String
  explanation       String?
  points            Int            @default(1)
  answers           Answer[]
}

model Assignment {
  id            String                @id @default(cuid())
  teacherId      String
  title         String
  instructions  String?
  deadline      DateTime?
  timeLimitMinutes Int?
  mode          AssignmentMode        @default(homework)
  units         AssignmentUnit[]
  recipients    AssignmentRecipient[]
  createdAt     DateTime              @default(now())
}

model AssignmentUnit {
  id                    String         @id @default(cuid())
  assignmentId           String
  assignableUnitId       String
  order                 Int
  customTimeLimitMinutes Int?
  assignment             Assignment     @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  assignableUnit         AssignableUnit @relation(fields: [assignableUnitId], references: [id], onDelete: Cascade)
}

model AssignmentRecipient {
  id           String          @id @default(cuid())
  assignmentId String
  studentId    String
  status       RecipientStatus @default(assigned)
  assignment   Assignment      @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  student      StudentProfile  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  attempts     Attempt[]
}

model Attempt {
  id                    String              @id @default(cuid())
  assignmentRecipientId  String
  studentId              String
  assignmentRecipient    AssignmentRecipient @relation(fields: [assignmentRecipientId], references: [id], onDelete: Cascade)
  student                StudentProfile      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  startedAt              DateTime            @default(now())
  submittedAt            DateTime?
  status                 RecipientStatus     @default(in_progress)
  submitReason           SubmitReason?
  elapsedSeconds         Int                 @default(0)
  tabSwitchCount         Int                 @default(0)
  score                  Float?
  scorePercent           Float?
  autoGradedAt           DateTime?
  answers                Answer[]
  highlights             Highlight[]
  review                 TeacherReview?
}

model Answer {
  id                    String          @id @default(cuid())
  attemptId              String
  questionId             String?
  assignableUnitId       String
  value                  String
  isCorrect              Boolean?
  pointsAwarded          Float?
  correctAnswerSnapshot  String?
  explanationSnapshot    String?
  attempt                Attempt         @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question               Question?       @relation(fields: [questionId], references: [id], onDelete: SetNull)
}

model Highlight {
  id               String         @id @default(cuid())
  attemptId         String
  assignableUnitId  String
  sourceType        String
  selectedText      String
  startOffset       Int
  endOffset         Int
  color             String
  note              String?
  attempt           Attempt       @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  createdAt         DateTime      @default(now())
}

model TeacherReview {
  id               String         @id @default(cuid())
  attemptId         String         @unique
  teacherId         String
  overallBand       Float
  criteriaScoresJson String
  summaryFeedback   String
  detailedFeedback  String
  attempt           Attempt        @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  teacher           TeacherProfile @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  reviewedAt        DateTime       @default(now())
}
```

- [ ] **Step 2: Add Prisma singleton**

Create `lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Add seed data**

Create `lib/seed-data.ts` with one teacher, two students, one class, one Reading material, one Listening material, one Writing prompt, and one Speaking prompt. Use passwords `teacher123` and `student123` for local demo users.

Create `prisma/seed.ts`:

```ts
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function main() {
  const teacherPassword = await bcrypt.hash("teacher123", 10);
  const studentPassword = await bcrypt.hash("student123", 10);

  const teacherUser = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      name: "Ms. Trang",
      email: "teacher@example.com",
      role: "teacher",
      passwordHash: teacherPassword,
      teacherProfile: { create: {} },
    },
    include: { teacherProfile: true },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      name: "Minh Anh",
      email: "student@example.com",
      role: "student",
      passwordHash: studentPassword,
      studentProfile: { create: { displayName: "Minh Anh", email: "student@example.com" } },
    },
    include: { studentProfile: true },
  });

  const classRoom = await prisma.class.create({
    data: {
      name: "IELTS Foundation A",
      description: "Demo IELTS class",
      teacherId: teacherUser.teacherProfile!.id,
      students: {
        create: [{ studentId: studentUser.studentProfile!.id }],
      },
    },
  });

  const reading = await prisma.material.create({
    data: {
      teacherId: teacherUser.teacherProfile!.id,
      skill: "reading",
      title: "Cambridge Demo Reading Test",
      sourceLabel: "Demo",
      units: {
        create: [
          {
            skill: "reading",
            unitType: "reading_passage",
            unitNumber: 1,
            title: "Passage 1: Georgia O'Keeffe",
            content: "Born in 1887 near Sun Prairie, Wisconsin, Georgia O'Keeffe became a major figure in American art.",
            defaultTimeLimitMinutes: 20,
            questions: {
              create: [
                {
                  order: 1,
                  questionType: "short_answer",
                  prompt: "Where was Georgia O'Keeffe born?",
                  correctAnswerJson: JSON.stringify(["Sun Prairie", "near Sun Prairie"]),
                  explanation: "The passage states she was born near Sun Prairie.",
                },
              ],
            },
          },
        ],
      },
    },
  });

  const listening = await prisma.material.create({
    data: {
      teacherId: teacherUser.teacherProfile!.id,
      skill: "listening",
      title: "Cambridge Demo Listening Test",
      sourceLabel: "Demo",
      units: {
        create: [
          {
            skill: "listening",
            unitType: "listening_part",
            unitNumber: 1,
            title: "Part 1: Booking Form",
            transcript: "Good morning. I would like to book a tour for Friday.",
            defaultTimeLimitMinutes: 10,
            questions: {
              create: [
                {
                  order: 1,
                  questionType: "short_answer",
                  prompt: "Which day is the tour?",
                  correctAnswerJson: JSON.stringify(["Friday"]),
                  explanation: "The speaker says they would like to book a tour for Friday.",
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.material.createMany({
    data: [
      {
        teacherId: teacherUser.teacherProfile!.id,
        skill: "writing",
        title: "Writing Task 2 - Education",
        sourceLabel: "Demo",
      },
      {
        teacherId: teacherUser.teacherProfile!.id,
        skill: "speaking",
        title: "Speaking Part 2 - Describe a person",
        sourceLabel: "Demo",
      },
    ],
  });

  console.log({ teacher: teacherUser.email, student: studentUser.email, class: classRoom.name, reading: reading.title, listening: listening.title });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 4: Migrate and seed**

Create `.env`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="local-dev-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

Run:

```powershell
pnpm prisma:migrate --name init
pnpm prisma:seed
```

Expected: migration succeeds and seed logs demo teacher/student.

## Task 3: Auth And Role Routing

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/waiting/page.tsx`

- [ ] **Step 1: Add auth configuration**

Create `lib/auth.ts`:

```ts
import bcrypt from "bcryptjs";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Demo credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "missing-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "missing-google-client-secret",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      const student = await prisma.studentProfile.findUnique({ where: { email: user.email } });
      if (!student) return "/waiting";
      const appUser = await prisma.user.upsert({
        where: { email: user.email },
        update: { googleId: account.providerAccountId },
        create: {
          email: user.email,
          name: user.name || user.email,
          role: "student",
          googleId: account.providerAccountId,
        },
      });
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { userId: appUser.id },
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const appUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (appUser) {
          token.id = appUser.id;
          token.role = appUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "teacher" | "student";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
```

- [ ] **Step 2: Add route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Add login UI**

Create `app/(auth)/login/page.tsx`:

```tsx
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0b1117] p-6">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#111a24] p-6">
        <h1 className="text-2xl font-bold">IELTS Platform</h1>
        <p className="mt-2 text-sm text-[#9fb0c2]">Sign in as teacher or student.</p>
        <form
          className="mt-6 grid gap-3"
          action={async (formData) => {
            "use server";
            await signIn("credentials", {
              email: String(formData.get("email")),
              password: String(formData.get("password")),
              redirectTo: "/teacher",
            });
          }}
        >
          <input className="rounded border border-white/10 bg-black/20 p-3" name="email" defaultValue="teacher@example.com" />
          <input className="rounded border border-white/10 bg-black/20 p-3" name="password" type="password" defaultValue="teacher123" />
          <button className="rounded bg-[#b7e42f] p-3 font-semibold text-black">Sign in</button>
        </form>
        <form
          className="mt-3"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/student" });
          }}
        >
          <button className="w-full rounded border border-white/10 p-3">Continue with Google as student</button>
        </form>
      </section>
    </main>
  );
}
```

Create `app/(auth)/waiting/page.tsx`:

```tsx
export default function WaitingPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-md rounded-lg border border-white/10 bg-[#111a24] p-6 text-center">
        <h1 className="text-xl font-bold">Your teacher has not added this email yet</h1>
        <p className="mt-2 text-[#9fb0c2]">Ask your teacher to add your Google email to a class, then sign in again.</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Verify auth route builds**

Run:

```powershell
pnpm build
```

Expected: build passes. If NextAuth type augmentation is required, create `types/next-auth.d.ts` with `id` and `role` session fields.

## Task 4: Teacher Class And Student Management

**Files:**
- Create: `components/app-shell.tsx`
- Create: `lib/actions/classes.ts`
- Create: `app/teacher/layout.tsx`
- Create: `app/teacher/page.tsx`
- Create: `app/teacher/classes/page.tsx`
- Create: `app/teacher/students/[studentId]/page.tsx`

- [ ] **Step 1: Add class actions**

Create `lib/actions/classes.ts`:

```ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireTeacher() {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") throw new Error("Teacher access required");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { teacherProfile: true } });
  if (!user?.teacherProfile) throw new Error("Teacher profile missing");
  return user.teacherProfile;
}

export async function createClass(formData: FormData) {
  const teacher = await requireTeacher();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (name.length < 2) throw new Error("Class name must be at least 2 characters");
  await prisma.class.create({ data: { teacherId: teacher.id, name, description } });
}

export async function addStudent(formData: FormData) {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId"));
  const displayName = String(formData.get("displayName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Valid student email is required");
  const classRoom = await prisma.class.findFirst({ where: { id: classId, teacherId: teacher.id } });
  if (!classRoom) throw new Error("Class not found");
  const student = await prisma.studentProfile.upsert({
    where: { email },
    update: { displayName },
    create: { email, displayName },
  });
  await prisma.classStudent.upsert({
    where: { classId_studentId: { classId, studentId: student.id } },
    update: {},
    create: { classId, studentId: student.id },
  });
}
```

- [ ] **Step 2: Add teacher layout and classes page**

Create `components/app-shell.tsx`:

```tsx
import Link from "next/link";

export function AppShell({ role, children }: { role: "teacher" | "student"; children: React.ReactNode }) {
  const items =
    role === "teacher"
      ? [["Dashboard", "/teacher"], ["Classes", "/teacher/classes"], ["Materials", "/teacher/materials"], ["Assignments", "/teacher/assignments"], ["Review", "/teacher/review"]]
      : [["Dashboard", "/student"], ["History", "/student/history"], ["Ranking", "/student/ranking"]];

  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="border-r border-white/10 bg-[#111a24] p-4">
        <div className="mb-6 font-bold">IELTS Platform</div>
        <nav className="grid gap-2">
          {items.map(([label, href]) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm text-[#edf3f8] hover:bg-white/10">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

Create `app/teacher/layout.tsx`:

```tsx
import { AppShell } from "@/components/app-shell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="teacher">{children}</AppShell>;
}
```

Create `app/teacher/classes/page.tsx` with forms wired to `createClass` and `addStudent`.

- [ ] **Step 3: Verify class flow**

Run:

```powershell
pnpm dev
```

Expected: sign in as `teacher@example.com`, open `/teacher/classes`, create a class, add a student email, and see the new student listed.

## Task 5: Material Bank And Flexible Units

**Files:**
- Create: `lib/actions/materials.ts`
- Create: `components/material-editor.tsx`
- Create: `app/teacher/materials/page.tsx`

- [ ] **Step 1: Add material actions**

Create `lib/actions/materials.ts`:

```ts
"use server";

import { Skill, UnitType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireTeacherId() {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") throw new Error("Teacher access required");
  const teacher = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
  if (!teacher) throw new Error("Teacher profile missing");
  return teacher.id;
}

export async function createMaterial(formData: FormData) {
  const teacherId = await requireTeacherId();
  const title = String(formData.get("title") || "").trim();
  const skill = String(formData.get("skill")) as Skill;
  if (!title) throw new Error("Material title is required");
  await prisma.material.create({ data: { teacherId, title, skill, sourceLabel: String(formData.get("sourceLabel") || "") } });
}

export async function createUnit(formData: FormData) {
  const teacherId = await requireTeacherId();
  const materialId = String(formData.get("materialId"));
  const material = await prisma.material.findFirst({ where: { id: materialId, teacherId } });
  if (!material) throw new Error("Material not found");
  await prisma.assignableUnit.create({
    data: {
      materialId,
      skill: material.skill,
      unitType: String(formData.get("unitType")) as UnitType,
      unitNumber: Number(formData.get("unitNumber")),
      title: String(formData.get("title") || "").trim(),
      instructions: String(formData.get("instructions") || ""),
      content: String(formData.get("content") || ""),
      transcript: String(formData.get("transcript") || ""),
      audioUrl: String(formData.get("audioUrl") || ""),
      defaultTimeLimitMinutes: Number(formData.get("defaultTimeLimitMinutes") || 0) || null,
    },
  });
}
```

- [ ] **Step 2: Add materials page**

Create `app/teacher/materials/page.tsx` that lists materials and provides:

- material creation form with skill select;
- unit creation form for the selected material;
- unit list grouped by material;
- question creation form for Listening/Reading units.

Use these exact unit type values in selects:

```tsx
const unitTypes = [
  "listening_part",
  "reading_passage",
  "writing_task",
  "speaking_part",
] as const;
```

- [ ] **Step 3: Verify flexible units**

Run:

```powershell
pnpm dev
```

Expected: teacher can create a Listening material and add Part 1 and Part 4 as separate units.

## Task 6: Assignment Builder And Student Dashboard

**Files:**
- Create: `lib/actions/assignments.ts`
- Create: `components/assignment-builder.tsx`
- Create: `app/teacher/assignments/page.tsx`
- Create: `app/student/layout.tsx`
- Create: `app/student/page.tsx`

- [ ] **Step 1: Add assignment creation**

Create `lib/actions/assignments.ts`:

```ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireTeacherId() {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") throw new Error("Teacher access required");
  const teacher = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
  if (!teacher) throw new Error("Teacher profile missing");
  return teacher.id;
}

export async function createAssignment(formData: FormData) {
  const teacherId = await requireTeacherId();
  const title = String(formData.get("title") || "").trim();
  const unitIds = formData.getAll("unitIds").map(String);
  const studentIds = formData.getAll("studentIds").map(String);
  if (!title || unitIds.length === 0 || studentIds.length === 0) throw new Error("Title, units, and students are required");
  await prisma.assignment.create({
    data: {
      teacherId,
      title,
      instructions: String(formData.get("instructions") || ""),
      timeLimitMinutes: Number(formData.get("timeLimitMinutes") || 0) || null,
      units: {
        create: unitIds.map((assignableUnitId, index) => ({ assignableUnitId, order: index + 1 })),
      },
      recipients: {
        create: studentIds.map((studentId) => ({ studentId })),
      },
    },
  });
}
```

- [ ] **Step 2: Add teacher assignment page**

Create `components/assignment-builder.tsx` with checkbox sections:

```tsx
export function AssignmentBuilder({
  materials,
  students,
}: {
  materials: Array<{ id: string; title: string; units: Array<{ id: string; title: string; unitNumber: number }> }>;
  students: Array<{ id: string; displayName: string; email: string }>;
}) {
  return (
    <form action={createAssignment} className="grid gap-4 rounded-lg border border-white/10 bg-[#111a24] p-4">
      <input name="title" className="rounded bg-black/20 p-3" placeholder="Assignment title" />
      <textarea name="instructions" className="rounded bg-black/20 p-3" placeholder="Instructions" />
      <input name="timeLimitMinutes" className="rounded bg-black/20 p-3" placeholder="Time limit minutes" />
      <section className="grid gap-2">
        <h2 className="font-semibold">Units</h2>
        {materials.map((material) => (
          <div key={material.id}>
            <div className="text-sm text-[#9fb0c2]">{material.title}</div>
            {material.units.map((unit) => (
              <label key={unit.id} className="flex gap-2">
                <input type="checkbox" name="unitIds" value={unit.id} />
                <span>{unit.title}</span>
              </label>
            ))}
          </div>
        ))}
      </section>
      <section className="grid gap-2">
        <h2 className="font-semibold">Students</h2>
        {students.map((student) => (
          <label key={student.id} className="flex gap-2">
            <input type="checkbox" name="studentIds" value={student.id} />
            <span>{student.displayName} ({student.email})</span>
          </label>
        ))}
      </section>
      <button className="rounded bg-[#b7e42f] p-3 font-semibold text-black">Assign</button>
    </form>
  );
}
```

- [ ] **Step 3: Add student dashboard**

Create `app/student/layout.tsx` using `AppShell`.

Create `app/student/page.tsx` to list `AssignmentRecipient` records for the logged-in student with links to `/student/assignments/[recipientId]`.

- [ ] **Step 4: Verify assignment flow**

Run:

```powershell
pnpm dev
```

Expected: teacher can assign selected units to `student@example.com`; student dashboard shows the assignment.

## Task 7: Auto-Grading

**Files:**
- Create: `lib/grading.ts`
- Create: `tests/grading.test.ts`

- [ ] **Step 1: Write grading tests**

Create `tests/grading.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { gradeAnswer, gradeAttempt } from "@/lib/grading";

describe("gradeAnswer", () => {
  it("accepts exact answers case-insensitively", () => {
    expect(gradeAnswer("friday", ["Friday"])).toEqual({ isCorrect: true, pointsAwarded: 1 });
  });

  it("accepts any allowed answer", () => {
    expect(gradeAnswer("near Sun Prairie", ["Sun Prairie", "near Sun Prairie"])).toEqual({ isCorrect: true, pointsAwarded: 1 });
  });

  it("marks skipped answers as incorrect with zero points", () => {
    expect(gradeAnswer("", ["Friday"])).toEqual({ isCorrect: false, pointsAwarded: 0 });
  });
});

describe("gradeAttempt", () => {
  it("calculates score and percentage", () => {
    const result = gradeAttempt([
      { value: "Friday", correctAnswers: ["Friday"], points: 1 },
      { value: "Monday", correctAnswers: ["Sun Prairie"], points: 1 },
    ]);
    expect(result).toEqual({ score: 1, maxScore: 2, scorePercent: 50 });
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm test tests/grading.test.ts
```

Expected: fail because `lib/grading.ts` does not exist.

- [ ] **Step 3: Implement grading**

Create `lib/grading.ts`:

```ts
export function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function gradeAnswer(value: string, correctAnswers: string[], points = 1) {
  const normalizedValue = normalizeAnswer(value);
  const isCorrect = correctAnswers.some((answer) => normalizeAnswer(answer) === normalizedValue);
  return { isCorrect, pointsAwarded: isCorrect ? points : 0 };
}

export function gradeAttempt(items: Array<{ value: string; correctAnswers: string[]; points: number }>) {
  const maxScore = items.reduce((sum, item) => sum + item.points, 0);
  const score = items.reduce((sum, item) => sum + gradeAnswer(item.value, item.correctAnswers, item.points).pointsAwarded, 0);
  const scorePercent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  return { score, maxScore, scorePercent };
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```powershell
pnpm test tests/grading.test.ts
```

Expected: all grading tests pass.

## Task 8: Student Attempt Workspace And Highlighting

**Files:**
- Create: `lib/actions/attempts.ts`
- Create: `components/attempt-workspace.tsx`
- Create: `components/highlight-layer.tsx`
- Create: `app/student/assignments/[recipientId]/page.tsx`

- [ ] **Step 1: Add attempt actions**

Create `lib/actions/attempts.ts`:

```ts
"use server";

import { auth } from "@/lib/auth";
import { gradeAnswer, gradeAttempt } from "@/lib/grading";
import { prisma } from "@/lib/prisma";

async function requireStudentId() {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") throw new Error("Student access required");
  const student = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!student) throw new Error("Student profile missing");
  return student.id;
}

export async function startAttempt(recipientId: string) {
  const studentId = await requireStudentId();
  const recipient = await prisma.assignmentRecipient.findFirst({ where: { id: recipientId, studentId } });
  if (!recipient) throw new Error("Assignment not found");
  await prisma.assignmentRecipient.update({ where: { id: recipientId }, data: { status: "in_progress" } });
  return prisma.attempt.create({ data: { assignmentRecipientId: recipientId, studentId } });
}

export async function saveHighlight(formData: FormData) {
  const studentId = await requireStudentId();
  const attemptId = String(formData.get("attemptId"));
  const attempt = await prisma.attempt.findFirst({ where: { id: attemptId, studentId } });
  if (!attempt) throw new Error("Attempt not found");
  await prisma.highlight.create({
    data: {
      attemptId,
      assignableUnitId: String(formData.get("assignableUnitId")),
      sourceType: String(formData.get("sourceType")),
      selectedText: String(formData.get("selectedText")),
      startOffset: Number(formData.get("startOffset")),
      endOffset: Number(formData.get("endOffset")),
      color: String(formData.get("color")),
      note: String(formData.get("note") || ""),
    },
  });
}

export async function submitAttempt(formData: FormData) {
  const studentId = await requireStudentId();
  const attemptId = String(formData.get("attemptId"));
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId },
    include: {
      assignmentRecipient: {
        include: {
          assignment: {
            include: { units: { include: { assignableUnit: { include: { questions: true } } } } },
          },
        },
      },
    },
  });
  if (!attempt) throw new Error("Attempt not found");

  const createdAnswers = [];
  const gradeItems = [];
  for (const assignmentUnit of attempt.assignmentRecipient.assignment.units) {
    for (const question of assignmentUnit.assignableUnit.questions) {
      const value = String(formData.get(`q_${question.id}`) || "");
      const correctAnswers = JSON.parse(question.correctAnswerJson) as string[];
      const graded = gradeAnswer(value, correctAnswers, question.points);
      createdAnswers.push({
        attemptId,
        questionId: question.id,
        assignableUnitId: assignmentUnit.assignableUnitId,
        value,
        isCorrect: graded.isCorrect,
        pointsAwarded: graded.pointsAwarded,
        correctAnswerSnapshot: question.correctAnswerJson,
        explanationSnapshot: question.explanation,
      });
      gradeItems.push({ value, correctAnswers, points: question.points });
    }
  }

  const grade = gradeAttempt(gradeItems);
  await prisma.answer.createMany({ data: createdAnswers });
  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: "submitted",
      submittedAt: new Date(),
      submitReason: String(formData.get("submitReason")) === "auto_timeout" ? "auto_timeout" : "manual",
      elapsedSeconds: Number(formData.get("elapsedSeconds") || 0),
      tabSwitchCount: Number(formData.get("tabSwitchCount") || 0),
      score: grade.score,
      scorePercent: grade.scorePercent,
      autoGradedAt: new Date(),
    },
  });
  await prisma.assignmentRecipient.update({ where: { id: attempt.assignmentRecipientId }, data: { status: "submitted" } });
}
```

- [ ] **Step 2: Add highlight component**

Create `components/highlight-layer.tsx`:

```tsx
"use client";

import { useState } from "react";

export function HighlightLayer({
  text,
  onHighlight,
}: {
  text: string;
  onHighlight: (payload: { selectedText: string; startOffset: number; endOffset: number; color: string; note: string }) => void;
}) {
  const [selection, setSelection] = useState("");

  function captureSelection() {
    const selected = window.getSelection()?.toString() || "";
    setSelection(selected.trim());
  }

  return (
    <div onMouseUp={captureSelection} className="relative whitespace-pre-wrap leading-8">
      {text}
      {selection ? (
        <div className="mt-3 flex gap-2 rounded bg-[#172232] p-2">
          {["#b7e42f", "#4c6fff", "#ff6767"].map((color) => (
            <button
              key={color}
              type="button"
              className="h-8 w-8 rounded"
              style={{ background: color }}
              onClick={() => {
                const startOffset = text.indexOf(selection);
                onHighlight({ selectedText: selection, startOffset, endOffset: startOffset + selection.length, color, note: "" });
                setSelection("");
              }}
              aria-label={`Highlight ${color}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Add attempt page**

Create `app/student/assignments/[recipientId]/page.tsx` that:

- loads the recipient and assignment units;
- starts an attempt if none is in progress;
- renders `AttemptWorkspace`;
- posts answers to `submitAttempt`;
- posts highlights through `saveHighlight`.

- [ ] **Step 4: Verify Reading/Listening attempt**

Run:

```powershell
pnpm dev
```

Expected: student opens assignment, answers question, highlights passage/transcript text, submits, and receives a submitted attempt.

## Task 9: Result Review, History, And Teacher Review

**Files:**
- Create: `components/result-review.tsx`
- Create: `components/review-form.tsx`
- Create: `lib/actions/reviews.ts`
- Create: `app/student/results/[attemptId]/page.tsx`
- Create: `app/student/history/page.tsx`
- Create: `app/teacher/review/page.tsx`

- [ ] **Step 1: Add teacher review action**

Create `lib/actions/reviews.ts`:

```ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireTeacherId() {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") throw new Error("Teacher access required");
  const teacher = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id } });
  if (!teacher) throw new Error("Teacher profile missing");
  return teacher.id;
}

export async function saveTeacherReview(formData: FormData) {
  const teacherId = await requireTeacherId();
  const attemptId = String(formData.get("attemptId"));
  const overallBand = Number(formData.get("overallBand"));
  const summaryFeedback = String(formData.get("summaryFeedback") || "").trim();
  const detailedFeedback = String(formData.get("detailedFeedback") || "").trim();
  if (!overallBand || !summaryFeedback) throw new Error("Band score and summary feedback are required");
  await prisma.teacherReview.upsert({
    where: { attemptId },
    update: {
      teacherId,
      overallBand,
      summaryFeedback,
      detailedFeedback,
      criteriaScoresJson: String(formData.get("criteriaScoresJson") || "{}"),
      reviewedAt: new Date(),
    },
    create: {
      attemptId,
      teacherId,
      overallBand,
      summaryFeedback,
      detailedFeedback,
      criteriaScoresJson: String(formData.get("criteriaScoresJson") || "{}"),
    },
  });
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (attempt) {
    await prisma.attempt.update({ where: { id: attemptId }, data: { status: "reviewed" } });
    await prisma.assignmentRecipient.update({ where: { id: attempt.assignmentRecipientId }, data: { status: "reviewed" } });
  }
}
```

- [ ] **Step 2: Add result review UI**

Create `components/result-review.tsx`:

```tsx
export function ResultReview({ attempt }: { attempt: any }) {
  return (
    <section className="grid gap-4">
      <div className="rounded-lg bg-[#111a24] p-4">
        <h1 className="text-2xl font-bold">{attempt.score ?? "Pending"} / {attempt.answers.length}</h1>
        <p className="text-[#9fb0c2]">{attempt.scorePercent ?? 0}% correct</p>
      </div>
      {attempt.answers.map((answer: any) => (
        <article key={answer.id} className={`rounded-lg border p-4 ${answer.isCorrect ? "border-[#55d987]" : "border-[#ff6767]"}`}>
          <div className="font-semibold">{answer.question?.prompt}</div>
          <div>Your answer: {answer.value || "Skipped"}</div>
          <div>Correct answer: {answer.correctAnswerSnapshot}</div>
          <div className="text-[#9fb0c2]">{answer.explanationSnapshot}</div>
        </article>
      ))}
    </section>
  );
}
```

Create `components/review-form.tsx` with fields `overallBand`, `criteriaScoresJson`, `summaryFeedback`, and `detailedFeedback` posting to `saveTeacherReview`.

- [ ] **Step 3: Add result/history/review pages**

Create pages:

- `/student/results/[attemptId]` shows `ResultReview`.
- `/student/history` lists all attempts for the student.
- `/teacher/review` lists submitted Writing/Speaking attempts and renders `ReviewForm`.

- [ ] **Step 4: Verify review flow**

Run:

```powershell
pnpm dev
```

Expected: student sees Listening/Reading result details; teacher can review a pending Writing/Speaking attempt and student history reflects reviewed state.

## Task 10: Ranking

**Files:**
- Create: `lib/ranking.ts`
- Create: `tests/ranking.test.ts`
- Create: `app/student/ranking/page.tsx`

- [ ] **Step 1: Write ranking tests**

Create `tests/ranking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateRankingScore } from "@/lib/ranking";

describe("calculateRankingScore", () => {
  it("uses 70 score, 20 completion, 10 activity weighting", () => {
    const score = calculateRankingScore({ averageScorePercent: 80, completionRate: 90, recentActivityPercent: 50 });
    expect(score).toBe(79);
  });
});
```

- [ ] **Step 2: Implement ranking calculation**

Create `lib/ranking.ts`:

```ts
export function calculateRankingScore(input: {
  averageScorePercent: number;
  completionRate: number;
  recentActivityPercent: number;
}) {
  return Math.round(input.averageScorePercent * 0.7 + input.completionRate * 0.2 + input.recentActivityPercent * 0.1);
}
```

- [ ] **Step 3: Run ranking tests**

Run:

```powershell
pnpm test tests/ranking.test.ts
```

Expected: ranking test passes.

- [ ] **Step 4: Add ranking page**

Create `app/student/ranking/page.tsx` that:

- finds the student's classes;
- lists classmates;
- computes average score percent from attempts;
- computes completion rate from recipients;
- uses a fixed recent activity input of `100` for students with an attempt in the last 7 days and `0` otherwise;
- sorts descending by `calculateRankingScore`.

## Task 11: End-To-End Verification

**Files:**
- Create: `tests/e2e/teacher-student-flow.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Add Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
```

- [ ] **Step 2: Add E2E smoke test**

Create `tests/e2e/teacher-student-flow.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("teacher and student demo pages load", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("IELTS Platform")).toBeVisible();
  await page.goto("/teacher/classes");
  await expect(page.locator("body")).toBeVisible();
  await page.goto("/student");
  await expect(page.locator("body")).toBeVisible();
});
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
pnpm build
pnpm test
pnpm test:e2e
```

Expected:

- production build succeeds;
- unit tests pass;
- e2e smoke test passes.

## Task 12: Final Manual QA Checklist

**Files:**
- Modify only files needed to fix defects found during QA.

- [ ] **Step 1: Verify teacher workflows**

In the browser:

1. Sign in as `teacher@example.com` / `teacher123`.
2. Create a class.
3. Add `student@example.com`.
4. Create a Reading material.
5. Add Passage 1.
6. Add one question and correct answer.
7. Create an assignment selecting only Passage 1.
8. Assign to `student@example.com`.

Expected: teacher sees the assignment and the student recipient.

- [ ] **Step 2: Verify student workflows**

In the browser:

1. Sign in as `student@example.com` / `student123`.
2. Open the assigned work.
3. Highlight a phrase.
4. Answer the question.
5. Submit.
6. Open the result.

Expected: result shows score, correct answer, explanation, and saved highlight.

- [ ] **Step 3: Verify manual review**

Create or seed one Writing/Speaking assignment, submit it as student, open `/teacher/review`, add band score and feedback.

Expected: student history shows reviewed state and feedback.

- [ ] **Step 4: Commit final MVP**

Run:

```powershell
git status --short
git add .
git commit -m "feat: build IELTS platform MVP"
```

Expected: commit succeeds with all MVP files included.
