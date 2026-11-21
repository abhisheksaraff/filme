// lib/openCard.ts
// Which viewing card is unfolded. Only one at a time: opening a card rolls up the one that was open.
// Callers pass a key that includes the page, so the same viewing on two pages opens independently.
import { useEffect, useSyncExternalStore } from "react";

let openId: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether this card is the open one, and a function that opens it, or closes it when it is already open. */
export function useOpenCard(id: string): { open: boolean; toggle: () => void } {
  const current = useSyncExternalStore(subscribe, () => openId, () => null);
  const open = current === id;
  // Scrolling folds an open card back down, so it never stays risen while the page moves under it.
  useEffect(() => {
    if (!open) return;
    const from = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - from) < 12) return;
      if (openId === id) {
        openId = null;
        listeners.forEach((l) => l());
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open, id]);
  return {
    open: current === id,
    toggle: () => {
      openId = current === id ? null : id;
      listeners.forEach((l) => l());
    },
  };
}
