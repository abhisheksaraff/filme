// lib/openCard.ts
// Which viewing card is unfolded. Only one at a time: opening a card rolls up the one that was open.
import { useSyncExternalStore } from "react";

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
  return {
    open: current === id,
    toggle: () => {
      openId = current === id ? null : id;
      listeners.forEach((l) => l());
    },
  };
}
