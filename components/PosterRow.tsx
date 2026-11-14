// components/PosterRow.tsx
// A sideways-scrolling strip of posters; a ✦ marks random surprise picks.
import Link from "next/link";
import type { RowItem } from "@/lib/home/rows";

export default function PosterRow({ items }: { items: RowItem[] }) {
  return (
    <ul className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2">
      {items.map((item) => (
        <li key={item.key} className="w-28 shrink-0">
          <Link href={item.href} className="flex flex-col gap-1">
            <div className="relative">
              {item.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.posterUrl} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-[2/3] w-full rounded-lg bg-neutral-200 dark:bg-neutral-800" />
              )}
              {item.surprise && (
                <span
                  title="Surprise pick"
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                >
                  ✦
                </span>
              )}
            </div>
            <span className="line-clamp-2 text-xs font-medium">{item.title}</span>
            {item.subtitle && <span className="text-xs text-neutral-500">{item.subtitle}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
