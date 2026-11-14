// components/BackLink.tsx
// Goes back to wherever the user came from, or to Home when the page was opened directly.
"use client";

import { useRouter } from "next/navigation";

export default function BackLink({ fallback = "/home/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="self-start text-sm text-neutral-500"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      ← Back
    </button>
  );
}
