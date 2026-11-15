// components/FocusProxy.tsx
// An invisible text field in the page frame that a tap can focus before the next page exists; see lib/searchFocus.ts.
"use client";

import { useCallback } from "react";
import { searchFocus } from "@/lib/searchFocus";

export default function FocusProxy() {
  const ref = useCallback((el: HTMLInputElement | null) => searchFocus.attach(el), []);
  return (
    // 16px keeps iOS from zooming; it has no size, cannot be tapped and is hidden from screen readers.
    <input ref={ref} type="search" tabIndex={-1} aria-hidden autoComplete="off" readOnly={false}
      className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0 [font-size:16px]" />
  );
}
