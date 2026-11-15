// components/WatchButton.tsx
// The round Watch button: checks the link as soon as it appears, then opens it in one tap.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Popup, { NoticePopup, POPUP_OPTION, PopupAction } from "@/components/Popup";
import { toast } from "@/components/Toast";
import RoundButton from "@/components/RoundButton";
import type { WatchContext } from "@/lib/domain/watchLinks";
import { openWatchLink, resolveWatch, type WatchTarget } from "@/lib/watch";

type PopupKind = "down" | "unset" | "failed" | "choose" | null;

const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** The plain https link goes to the share sheet (AirDrop on Apple devices), or to the clipboard where there is none. */
async function sendLink(url: string, title: string): Promise<void> {
  if (canShare()) {
    try {
      await navigator.share({ url, title });
    } catch {
      // Closing the share sheet is not an error.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    toast("Could not copy the link");
  }
}

export default function WatchButton({ watch }: { watch: WatchContext }) {
  const [target, setTarget] = useState<WatchTarget | "checking" | "failed">("checking");
  const [popup, setPopup] = useState<PopupKind>(null);
  // The page that exists, waiting while the popup asks where to open it.
  const [url, setUrl] = useState<string | null>(null);
  // Set when the button is tapped before the check has finished; the link then opens as soon as it has.
  const [waiting, setWaiting] = useState(false);
  const tapped = useRef(false);
  const router = useRouter();

  // Checked as soon as the button appears, so tapping it can open the link at once.
  const key = JSON.stringify([watch.kind, watch.tmdbId, watch.title, watch.season ?? null, watch.episode ?? null]);
  useEffect(() => {
    let cancelled = false;
    resolveWatch(watch).then((res) => {
      if (cancelled) return;
      const next = res.ok ? res.value : "failed";
      setTarget(next);
      if (tapped.current) {
        tapped.current = false;
        setWaiting(false);
        act(next);
      }
    });
    return () => {
      cancelled = true;
    };
    // `watch` is rebuilt every render; its contents are what `key` stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const down = typeof target === "object" && target.kind === "down";

  function act(result: WatchTarget | "failed") {
    if (result === "failed") return setPopup("failed");
    if (result.kind === "ready") {
      setUrl(result.url);
      return setPopup("choose");
    }
    setPopup(result.kind);
  }

  function onWatch() {
    if (target === "checking") {
      tapped.current = true;
      setWaiting(true);
      return;
    }
    act(target);
  }

  return (
    <>
      <span className="relative">
        <RoundButton icon="watch" label={down ? "Server is down" : "Watch"} tone="dark" size="lg" onClick={onWatch} className={down ? "!opacity-40" : ""} />
        {/* A thin ring turns around the button only after it is tapped while the check is still running. */}
        {waiting && <span aria-hidden className="pointer-events-none absolute -inset-1 animate-spin rounded-full border-2 border-transparent border-t-neutral-950 dark:border-t-white" />}
      </span>
      {popup === "choose" && url && (
        <Popup title="Watch" onClose={() => setPopup(null)}>
          <div className="flex flex-col">
            <button type="button" className={POPUP_OPTION} onClick={() => { setPopup(null); openWatchLink(url); }}>Open on this device</button>
            <button type="button" className={POPUP_OPTION} onClick={() => { setPopup(null); void sendLink(url, watch.title); }}>{canShare() ? "Send to another device" : "Copy link"}</button>
          </div>
          <div className="flex justify-center"><PopupAction icon="close" label="Close" tone="cancel" onClick={() => setPopup(null)} /></div>
        </Popup>
      )}
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
