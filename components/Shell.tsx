// components/Shell.tsx
// The frame shared by every page: a round back button at the top left and the bottom bar.
"use client";

import { usePathname, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import RoundButton from "@/components/RoundButton";

/** No bottom bar: signed-out pages and the full-screen recap. */
const NO_NAV = ["/", "/login/", "/story/"];
/** No back button: Home is the end of the trail, and the title page has its own on the poster. */
const NO_BACK = ["/", "/login/", "/home/", "/story/", "/title/", "/preview/"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const raw = usePathname() ?? "/";
  const path = raw.endsWith("/") ? raw : `${raw}/`;
  const showNav = !NO_NAV.includes(path);
  const showBack = !NO_BACK.includes(path);

  return (
    <>
      {showBack && (
        <>
          <div className="fixed left-4 top-[max(0.75rem,env(safe-area-inset-top))] z-30">
            <RoundButton
              icon="back"
              label="Back"
              onClick={() => (window.history.length > 1 ? router.back() : router.push("/home/"))}
            />
          </div>
          <div aria-hidden className="h-16 shrink-0" />
        </>
      )}
      {children}
      {/* Keeps the last line of every page clear of the floating bar. */}
      {showNav && <div aria-hidden className="h-28 shrink-0" />}
      {showNav && <BottomNav />}
    </>
  );
}
