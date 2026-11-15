// lib/toast.ts
// Shows a short message from anywhere; ToastHost (mounted once in the layout) draws it.
export const TOAST_EVENT = "filme-toast";

export function toast(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}
