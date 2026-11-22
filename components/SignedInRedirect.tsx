// components/SignedInRedirect.tsx
// Wraps the welcome and log-in pages: someone who is already signed in goes straight to Home, and nothing flashes on the way.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { hasStoredSession } from "@/lib/storedSession";
import { services } from "@/lib/services";

const noSubscription = () => () => {};

export default function SignedInRedirect({ children }: { children: ReactNode }) {
  const router = useRouter();
  // A sign-in saved on this device keeps the page blank while it is checked, so the welcome page never flashes by.
  const saved = useSyncExternalStore(noSubscription, hasStoredSession, () => false);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.auth.hasSession().then((signedIn) => {
      if (cancelled) return;
      setConfirmed(signedIn);
      if (signedIn) router.replace("/home/");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (confirmed ?? saved) ? null : <>{children}</>;
}
