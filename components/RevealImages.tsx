// components/RevealImages.tsx
// Makes every picture fade in once it has loaded instead of popping in line by line. It listens once for the whole app.
"use client";

import { useEffect } from "react";

export default function RevealImages() {
  useEffect(() => {
    const mark = (img: HTMLImageElement) => img.classList.add("img-loaded");
    // `load` does not bubble, so it is caught on the way down.
    const onLoad = (e: Event) => e.target instanceof HTMLImageElement && mark(e.target);
    document.addEventListener("load", onLoad, true);

    // Pictures added to the page already loaded (cached) never fire `load` after we listen.
    const sweep = (root: ParentNode) => root.querySelectorAll("img").forEach((img) => img.complete && mark(img));
    sweep(document);
    const watcher = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => {
        if (n instanceof HTMLImageElement) {
          if (n.complete) mark(n);
        } else if (n instanceof Element) sweep(n);
      });
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("load", onLoad, true);
      watcher.disconnect();
    };
  }, []);
  return null;
}
