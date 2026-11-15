// components/Toast.tsx
// A short black pill at the top right that says what just happened, then fades away on its own.
"use client";

import { useEffect, useState } from "react";

const SHOW_MS = 2000;
const EVENT = "filme-toast";

/** Shows a short message from anywhere; ToastHost (mounted once in the layout) draws it. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export default function ToastHost() {
  const [current, setCurrent] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let n = 0;
    const onToast = (e: Event) => {
      clearTimeout(timer);
      setCurrent({ id: ++n, message: (e as CustomEvent<string>).detail });
      timer = setTimeout(() => setCurrent(null), SHOW_MS);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!current) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[70]">
      <p key={current.id} role="status" className="toast-in rounded-full bg-black px-4 py-2 text-sm text-white shadow-lg">{current.message}</p>
    </div>
  );
}
