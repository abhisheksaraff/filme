// app/session/page.tsx
// Old links to a single viewing: viewings now live on their title's page, so this sends the visitor there.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useRequireSession } from "@/hooks/useRequireSession";
import { services } from "@/lib/services";

function Redirect() {
  const ready = useRequireSession();
  const router = useRouter();
  const id = useSearchParams().get("id");

  useEffect(() => {
    if (!ready) return;
    if (!id) return void router.replace("/watchlist/");
    services.log.getViewing(id).then((res) => router.replace(res.ok ? `/title/?id=${res.value.mediaId}&v=${id}` : "/watchlist/"));
  }, [ready, id, router]);

  return null;
}

export default function SessionPage() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  );
}
