// components/WatchButton.tsx
// The round Watch button: checks the link as soon as it appears, then opens it in one tap.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NoticePopup } from "@/components/Popup";
import RoundButton from "@/components/RoundButton";
import type { WatchContext } from "@/lib/domain/watchLinks";
import { openWatchLink, resolveWatch, type WatchTarget } from "@/lib/watch";

type Popup = "down" | "unset" | "failed" | null;

export default function WatchButton({ watch }: { watch: WatchContext }) {
  const [target, setTarget] = useState<WatchTarget | "checking" | "failed">("checking");
  const [popup, setPopup] = useState<Popup>(null);
  const router = useRouter();

  // Checked as soon as the button appears, so tapping it can open the link at once.
  const key = JSON.stringify([watch.kind, watch.tmdbId, watch.title, watch.season ?? null, watch.episode ?? null]);
  useEffect(() => {
    let cancelled = false;
    resolveWatch(watch).then((res) => {
      if (!cancelled) setTarget(res.ok ? res.value : "failed");
    });
    return () => {
      cancelled = true;
    };
    // `watch` is rebuilt every render; its contents are what `key` stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const checking = target === "checking";
  const down = typeof target === "object" && target.kind === "down";

  function onWatch() {
    if (target === "checking") return;
    if (target === "failed") return setPopup("failed");
    if (target.kind === "ready") return openWatchLink(target.url);
    setPopup(target.kind);
  }

  return (
    <>
      <span className={checking ? "animate-pulse" : ""}>
        <RoundButton icon="watch" label={down ? "Server is down" : "Watch"} tone="dark" size="lg" onClick={onWatch} className={down ? "!opacity-40" : ""} />
      </span>
      {popup === "down" && <NoticePopup title="Server is down" icon="watch" message="That server is down right now. Try again in a little while." onClose={() => setPopup(null)} />}
      {popup === "failed" && <NoticePopup title="Could not check" icon="watch" message="The link could not be checked. Check your connection and try again." onClose={() => setPopup(null)} />}
      {popup === "unset" && (
        <NoticePopup
          title="Set up Watch"
          icon="watch"
          message="Add the website's link under Profile, Watch link, and this button will open it for any title."
          onClose={() => setPopup(null)}
          extra={{ label: "Open settings", icon: "sliders", onClick: () => router.push("/profile/watch/") }}
        />
      )}
    </>
  );
}
