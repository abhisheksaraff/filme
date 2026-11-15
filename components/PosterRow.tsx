// components/PosterRow.tsx
// A sideways-scrolling strip of posters; a ✦ marks random surprise picks.
import Link from "next/link";
import { warmTitle } from "@/lib/handoff";
import type { RowItem } from "@/lib/home/rows";

export default function PosterRow({ items }: { items: RowItem[] }) {
  return (
    <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
      {items.map((item) => (
        <li key={item.key} className="w-28 shrink-0">
          <Link
            href={item.href}
            onClick={() => warmTitle(item.href, { title: item.title, posterUrl: item.posterUrl, subtitle: item.subtitle })}
            className="flex flex-col gap-1"
          >
            <div className="relative">
              {item.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.posterUrl} alt="" loading="lazy" decoding="async" className="aspect-[2/3] w-full rounded-lg object-cover" />
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
            {/* The text block keeps one fixed height, so every row is the same height before and after its pictures load. */}
            <span className="line-clamp-2 h-8 text-xs font-medium leading-4">{item.title}</span>
            <span className="h-4 text-xs leading-4 text-neutral-500">{item.subtitle}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
