// components/Popup.tsx
// The one popup used across the app: a black card with white text that floats above a dimmed page.
// ConfirmPopup asks a question with Cancel and an action; NoticePopup tells something with OK.
"use client";

import { useEffect, type ReactNode } from "react";
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

const BUTTON = "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-40";
/** A white button with black text: the main action. */
export const POPUP_PRIMARY = `${BUTTON} bg-white text-neutral-950`;
/** A translucent button: the way out. */
export const POPUP_SECONDARY = `${BUTTON} bg-white/15 text-white`;

export default function Popup({ title, icon, onClose, children, actions }: PopupProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    // Tapping the dimmed area outside the card closes it.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        // The thin light ring keeps the black card visible in dark mode; the stacked shadows lift it off the page.
        className="popup-in flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-neutral-950 p-6 text-white ring-1 ring-white/15 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.7),0_12px_24px_-8px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-neutral-950">
              <Icon name={icon} size={20} />
            </span>
          )}
          <h2 className="font-serif text-2xl leading-tight">{title}</h2>
        </div>
        {children}
        {actions && <div className="flex gap-3">{actions}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: IconName;
  icon?: IconName;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPopup({ title, message, confirmLabel, confirmIcon = "trash", icon, busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Popup
      title={title}
      icon={icon ?? confirmIcon}
      onClose={() => !busy && onCancel()}
      actions={
        <>
          <button type="button" className={POPUP_SECONDARY} onClick={onCancel} disabled={busy}>
            <Icon name="close" size={18} />
            Cancel
          </button>
          <button type="button" className={POPUP_PRIMARY} onClick={onConfirm} disabled={busy}>
            <Icon name={confirmIcon} size={18} />
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-white/70">{message}</p>
    </Popup>
  );
}

interface NoticeProps {
  title: string;
  message: string;
  icon?: IconName;
  /** An extra action beside OK, such as "Open settings". */
  extra?: { label: string; icon: IconName; onClick: () => void };
  onClose: () => void;
}

export function NoticePopup({ title, message, icon = "bell", extra, onClose }: NoticeProps) {
  return (
    <Popup
      title={title}
      icon={icon}
      onClose={onClose}
      actions={
        <>
          {extra && (
            <button type="button" className={POPUP_SECONDARY} onClick={extra.onClick}>
              <Icon name={extra.icon} size={18} />
              {extra.label}
            </button>
          )}
          <button type="button" className={POPUP_PRIMARY} onClick={onClose}>
            <Icon name="check" size={18} />
            OK
          </button>
        </>
      }
    >
      <p className="text-sm text-white/70">{message}</p>
    </Popup>
  );
}
