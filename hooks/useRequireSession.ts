// hooks/useRequireSession.ts
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { services } from "@/lib/services";

/** Sends visitors who are not signed in to the login page; returns true once a session is confirmed. */
export function useRequireSession(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    services.auth.hasSession().then((signedIn) => {
      if (cancelled) return;
      if (signedIn) setReady(true);
      else router.replace("/login/");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return ready;
}
