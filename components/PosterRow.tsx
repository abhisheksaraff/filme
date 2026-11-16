// components/PosterRow.tsx
// A sideways-scrolling strip of posters.
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { warmTitle } from "@/lib/handoff";
import { useWantedKeys, wantedKeyOf } from "@/lib/useWantedKeys";
import type { RowItem } from "@/lib/home/rows";

export default function PosterRow({ items }: { items: RowItem[] }) {
  const wanted = useWantedKeys();
  return (
    <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
      {items.map((item) => (
        <li key={item.key} className="w-28 shrink-0 md:w-36 lg:w-40">
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
              {wanted.has(wantedKeyOf(item.href) ?? "") && <StatusBadge kind="watchlist" maxSize={28} className="absolute right-[4%] top-[3%]" />}
            </div>
            {/* The year sits straight under the title, one line or two; the box keeps one fixed height so every row is the same height before and after its pictures load. */}
            <span className="flex h-12 flex-col">
              <span className="line-clamp-2 text-xs font-medium leading-4">{item.title}</span>
              <span className="text-xs leading-4 text-neutral-500">{item.subtitle}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
