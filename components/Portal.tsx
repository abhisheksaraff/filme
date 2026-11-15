// components/Portal.tsx
// Draws its children at the very top of the page, outside whichever page layer they were written in, so a popup or
// viewer always sits above the back button and bottom bar (which then sit dimmed behind its backdrop).
"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const never = () => () => {};
/** How many overlays are open; the page behind stays locked until the last one closes. */
let open = 0;

export default function Portal({ children }: { children: ReactNode }) {
  // False while the page is built on the server, true in the browser; there is no body to draw into before that.
  const inBrowser = useSyncExternalStore(never, () => true, () => false);

  useEffect(() => {
    open++;
    document.body.style.overflow = "hidden";
    return () => {
      open--;
      if (open === 0) document.body.style.overflow = "";
    };
  }, []);

  return inBrowser ? createPortal(children, document.body) : null;
}
