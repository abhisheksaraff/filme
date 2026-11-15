// components/Wordmark.tsx
// The filmè logo: an oversized italic Caslon f, whose tail hangs below the line, followed by the rest in upright Playfair.
import type { CSSProperties } from "react";

export default function Wordmark({ className = "" }: { className?: string }) {
  // The f's tail sweeps left under the baseline, so the word is pushed right to give it room.
  const f: CSSProperties = {
    fontFamily: "var(--font-caslon), Georgia, serif",
    fontStyle: "italic",
    fontSize: "1.3em",
    lineHeight: 1,
    marginRight: "0.02em",
  };
  return (
    <span role="img" aria-label="filmè" className={`inline-block pl-[0.3em] font-serif tracking-tight ${className}`}>
      <span aria-hidden style={f}>f</span>
      <span aria-hidden>ilmè</span>
    </span>
  );
}
