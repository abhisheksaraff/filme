// components/Popup.tsx
// The one popup used across the app: a black card with white text that floats above a dimmed page.
// ConfirmPopup asks a question with a cancel and an action; NoticePopup tells something. Every action is a round icon.
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Portal from "@/components/Portal";
import { pushOverlay } from "@/lib/overlayStack";
import Icon, { type IconName } from "@/components/Icon";

interface PopupProps {
  title: string;
  icon?: IconName;
  /** Closes the popup: outside tap, Escape, or a Cancel/OK button. */
  onClose: () => void;
  children?: ReactNode;
  /** The row of buttons under the content. */
  actions?: ReactNode;
}

/**
 * A popup's action as a round icon: white for the main action, a soft red-on-grey circle for the way out. The label is
 * spoken and shown as a tooltip, not drawn.
 */
export function PopupAction({ icon, label, tone = "primary", onClick, disabled }: { icon: IconName; label: string; tone?: "primary" | "cancel"; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-40 ${tone === "primary" ? "bg-white text-neutral-950" : "bg-white/10 text-red-400"}`}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
/** One choice in a list of choices: white text in a row, with a hairline between rows. */
export const POPUP_OPTION = "press popup-option flex w-full items-center justify-center py-3 text-center text-sm text-white disabled:opacity-40";

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
  /** The way out's spoken name; it is "Cancel" everywhere so the second choice is never a surprise. */
  cancelLabel?: string;
  /** The icon on the main action; a tick when left out. */
  confirmIcon?: IconName;
  icon?: IconName;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPopup({ title, message, confirmLabel, cancelLabel = "Cancel", confirmIcon = "check", busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Popup
      title={title}
      onClose={() => !busy && onCancel()}
      actions={
        <>
          <PopupAction icon="close" label={cancelLabel} tone="cancel" onClick={onCancel} disabled={busy} />
          <PopupAction icon={confirmIcon} label={confirmLabel} onClick={onConfirm} disabled={busy} />
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
          {extra && <PopupAction icon="close" label="Cancel" tone="cancel" onClick={onClose} />}
          <PopupAction icon={extra ? (extra.icon ?? "open") : "check"} label={extra ? extra.label : "OK"} onClick={extra ? extra.onClick : onClose} />
        </>
      }
    >
      <p className="text-[13px] leading-snug text-white/70">{message}</p>
    </Popup>
  );
}
