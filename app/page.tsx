import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.role === "teacher") {
    redirect("/teacher");
  }

  if (session?.user?.role === "student") {
    redirect("/student");
  }

  redirect("/login");
}
