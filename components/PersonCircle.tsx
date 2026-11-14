// components/PersonCircle.tsx
// A person as a round photo (or the default person icon) with their name, linking to their page.
import Link from "next/link";
import Icon from "@/components/Icon";
import { tmdbImageUrl } from "@/lib/adapters/tmdb/images";

interface Props {
  href: string;
  name: string;
  profilePath: string | null;
  /** A second line, such as the character played. */
  note?: string | null;
}

export default function PersonCircle({ href, name, profilePath, note }: Props) {
  const src = tmdbImageUrl(profilePath, "w185");
  return (
    <li className="w-20 shrink-0">
      <Link href={href} className="flex flex-col items-center gap-1 text-center text-xs">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950">
            <Icon name="user" size={26} />
          </span>
        )}
        <span className="line-clamp-2 font-medium leading-tight">{name}</span>
        {note && <span className="line-clamp-2 leading-tight text-neutral-500">{note}</span>}
      </Link>
    </li>
  );
}
