// components/Popup.tsx
// The one popup used across the app: a black card with white text that floats above a dimmed page.
// ConfirmPopup asks a question with Cancel and an action; NoticePopup tells something with OK.
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Portal from "@/components/Portal";
import { pushOverlay } from "@/lib/overlayStack";
import { type IconName } from "@/components/Icon";

interface PopupProps {
  title: string;
  icon?: IconName;
  /** Closes the popup: outside tap, Escape, or a Cancel/OK button. */
  onClose: () => void;
  children?: ReactNode;
  /** The row of buttons under the content. */
  actions?: ReactNode;
}

const ACTION = "py-1 text-sm font-medium disabled:opacity-40";
/** The main action: plain white text on the right of the row. */
export const POPUP_PRIMARY = `${ACTION} text-white`;
/** The way out: plain red text on the left of the row, always labelled Cancel. */
export const POPUP_SECONDARY = `${ACTION} text-red-400`;
/** One choice in a list of choices: white text in a row, with a hairline between rows. */
export const POPUP_OPTION = "flex w-full items-center justify-between border-t border-white/10 py-3 text-left text-sm text-white first:border-t-0 disabled:opacity-40";

export default function Popup({ title, onClose, children, actions }: PopupProps) {
  // Escape closes only the popup on top, not the ones underneath it.
  const top = useRef<ReturnType<typeof pushOverlay> | null>(null);
  useEffect(() => {
    top.current = pushOverlay();
    return () => top.current?.remove();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && top.current?.isTop() && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // Tapping the dimmed area outside the card closes it. It is drawn above the whole app, back button and bottom bar included.
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        // The thin light ring keeps the black card visible in dark mode; the stacked shadows lift it off the page.
        className="popup-in flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-neutral-950 p-6 text-white shadow-[0_30px_60px_-12px_rgba(0,0,0,0.7),0_12px_24px_-8px_rgba(0,0,0,0.5)]"
      >
        <h2 className="font-serif text-2xl leading-tight">{title}</h2>
        {children}
        {actions && <div className="flex items-center justify-center gap-14 pt-1">{actions}</div>}
      </div>
    </div>
    </Portal>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  /** The way out; it is "Cancel" everywhere so the second choice is never a surprise. */
  cancelLabel?: string;
  /** Kept so existing callers compile; popups no longer show an icon. */
  confirmIcon?: IconName;
  icon?: IconName;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPopup({ title, message, confirmLabel, cancelLabel = "Cancel", busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Popup
      title={title}
      onClose={() => !busy && onCancel()}
      actions={
        <>
          <button type="button" className={POPUP_SECONDARY} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={POPUP_PRIMARY} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </>
      }
    >
      <p className="text-[13px] leading-snug text-white/70">{message}</p>
    </Popup>
  );
}

interface NoticeProps {
  title: string;
  message: string;
  icon?: IconName;
  /** Replaces OK with a main action, such as "Open settings"; Cancel then sits on the left. */
  extra?: { label: string; icon?: IconName; onClick: () => void };
  onClose: () => void;
}

export function NoticePopup({ title, message, extra, onClose }: NoticeProps) {
  return (
    <Popup
      title={title}
      onClose={onClose}
      actions={
        <>
          {extra && <button type="button" className={POPUP_SECONDARY} onClick={onClose}>Cancel</button>}
          <button type="button" className={POPUP_PRIMARY} onClick={extra ? extra.onClick : onClose}>{extra ? extra.label : "OK"}</button>
        </>
      }
    >
      <p className="text-[13px] leading-snug text-white/70">{message}</p>
    </Popup>
  );
}
