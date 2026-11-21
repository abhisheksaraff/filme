// components/RoundButton.tsx
// An icon inside a circle, used for actions across the app instead of bordered text buttons.
import Link from "next/link";
import Icon, { type IconName } from "./Icon";

interface Props {
  icon: IconName;
  /** Spoken name and tooltip; the circle itself shows no text. */
  label: string;
  onClick?: () => void;
  href?: string;
  /** dark is a black circle, light is a soft grey one, danger is for deleting. */
  tone?: "dark" | "light" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  pressed?: boolean;
  /** Draws the icon solid, such as a saved bookmark. */
  filled?: boolean;
  className?: string;
}

const TONES = {
  dark: "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950",
  light: "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white",
  danger: "bg-neutral-100 text-red-600 dark:bg-neutral-800 dark:text-red-400",
};
/** A button that is switched on: black with a white icon (white with a black icon in dark mode). */
const PRESSED = "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950";
const SIZES = { sm: ["h-8 w-8", 16], md: ["h-10 w-10", 20], lg: ["h-12 w-12", 22] } as const;

export default function RoundButton({ icon, label, onClick, href, tone = "light", size = "md", disabled, pressed, filled, className = "" }: Props) {
  const [box, px] = SIZES[size];
  const classes = `inline-flex ${box} shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40 ${pressed ? PRESSED : TONES[tone]} ${className}`;
  const content = <Icon name={icon} size={px} filled={filled} />;
  return href ? (
    <Link href={href} aria-label={label} title={label} data-press className={classes}>{content}</Link>
  ) : (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={pressed} className={classes}>{content}</button>
  );
}
