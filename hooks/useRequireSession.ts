// hooks/useRequireSession.ts
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { hasStoredSession } from "@/lib/storedSession";
import { services } from "@/lib/services";

const noSubscription = () => () => {};

/**
 * Sends visitors who are not signed in to the welcome page, which has the Log in button; returns true once the page may be drawn.
 * A saved sign-in on the phone lets the page draw at once, with no blank moment, while the real check runs behind it.
 */
export function useRequireSession(): boolean {
  const router = useRouter();
  const saved = useSyncExternalStore(noSubscription, hasStoredSession, () => false);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.auth.hasSession().then((signedIn) => {
      if (cancelled) return;
      setConfirmed(signedIn);
      if (!signedIn) router.replace("/");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return confirmed ?? saved;
}
