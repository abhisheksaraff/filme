// components/PictureTiles.tsx
// Small pieces shared by every row of pictures: the + tile at the end of the row and the "main" star.
import Icon from "@/components/Icon";

/** The + tile that ends a row of pictures; sized by the caller to match the pictures beside it. */
export function AddTile({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`${className} flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Icon name="plus" size={18} /></span>
    </button>
  );
}

/** A black circle with a white star, drawn over a picture's top right corner to show it is the main one. */
export function MainBadge() {
  return (
    <span aria-label="Main picture" role="img" className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-md shadow-black/40">
      <Icon name="star" size={13} filled />
    </span>
  );
}
