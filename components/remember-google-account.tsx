"use client";

import { useEffect } from "react";
import { getSession } from "next-auth/react";
import { LAST_GOOGLE_ACCOUNT_KEY, type RememberedGoogleAccount } from "@/lib/google-account-memory";

export function RememberGoogleAccount() {
  useEffect(() => {
    let isMounted = true;

    async function rememberAccount() {
      const session = await getSession();

      if (!isMounted || session?.user?.role !== "student" || !session.user.email) {
        return;
      }

      const account: RememberedGoogleAccount = {
        name: session.user.name ?? session.user.email,
        email: session.user.email,
        image: session.user.image
      };

      localStorage.setItem(LAST_GOOGLE_ACCOUNT_KEY, JSON.stringify(account));
    }

    rememberAccount();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
