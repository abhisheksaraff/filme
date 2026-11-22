// components/Shell.tsx
// The frame shared by every page: a round back button at the top left and the bottom bar.
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import FocusProxy from "@/components/FocusProxy";
import RoundButton from "@/components/RoundButton";
import { notePath, openedFromOutside, recallScroll, saveScroll } from "@/lib/pageMemory";

/** No bottom bar: signed-out pages and the full-screen recap. */
const NO_NAV = ["/", "/login/", "/story/"];
/** No back button: Home is the end of the trail. */
const NO_BACK = ["/", "/login/", "/home/", "/story/"];
/** Pages that open on a cover photo or fill the screen: the same button floats over it instead of reserving a row. */
const OVER_COVER = ["/title/", "/preview/", "/map/", "/season/", "/episode/", "/collection/"];
/** The page fills the whole screen, so no space is kept free for the bottom bar. */
const FULL_SCREEN = ["/map/"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const raw = usePathname() ?? "/";
  const path = raw.endsWith("/") ? raw : `${raw}/`;
  const showNav = !NO_NAV.includes(path);
  const showBack = !NO_BACK.includes(path);
  const overCover = OVER_COVER.includes(path);
  const fullScreen = FULL_SCREEN.includes(path);

  // Keeps each page's scroll position, and returns to it when the page is reached with Back.
  useEffect(() => {
    notePath(path);
    const key = () => window.location.pathname + window.location.search;
    const onScroll = () => saveScroll(key(), window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });

    const target = recallScroll(key());
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The page fills in as its data arrives, so keep trying until it is tall enough to scroll there.
    const restore = () => {
      if (target === null || target <= 0) return;
      const tall = document.documentElement.scrollHeight >= target + window.innerHeight;
      if (tall || tries >= 30) window.scrollTo(0, target);
      if (!tall && tries++ < 30) timer = setTimeout(restore, 100);
    };
    restore();
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [path]);

  return (
    <>
      <FocusProxy />
      {showBack && (
        <>
          {/* Sits inside the same centred column as the pages, so it is in one place on phone and desktop. */}
          <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-30">
            <div className="mx-auto w-full max-w-md md:max-w-3xl lg:max-w-5xl px-4">
              <RoundButton
                icon="back"
                label="Back"
                className={`pointer-events-auto relative before:absolute before:-inset-3 before:content-[''] ${overCover ? "!bg-black/70 !text-white" : ""}`}
                // From another website the browser's Back would leave the app, so the app's own arrow goes to Home instead.
                onClick={() => (window.history.length > 1 && !openedFromOutside() ? router.back() : router.replace("/home/"))}
              />
            </div>
          </div>
          {!overCover && <div aria-hidden className="h-16 shrink-0" />}
        </>
      )}
      {children}
      {/* Keeps the last line of every page clear of the floating bar. */}
      {showNav && !fullScreen && <div aria-hidden className="h-28 shrink-0" />}
      {showNav && <BottomNav />}
    </>
  );
}
