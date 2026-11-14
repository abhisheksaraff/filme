// components/Avatar.tsx
// The profile picture, or the first letter of the account's email when there is none.
"use client";

import { useEffect, useState } from "react";
import { services } from "@/lib/services";

export default function Avatar({ size = 40 }: { size?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.images.avatar().then((res) => {
      if (!cancelled && res.ok) setUrl(res.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const box = { width: size, height: size };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Your profile picture" style={box} className="rounded-full object-cover" />
  ) : (
    <span style={box} className="flex items-center justify-center rounded-full bg-neutral-200 text-sm dark:bg-neutral-800" aria-hidden>
      ☺
    </span>
  );
}
