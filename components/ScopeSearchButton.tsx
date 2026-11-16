// components/ScopeSearchButton.tsx
// A grey round search button that opens Search limited to one list: what you have watched, or your Watchlist.
"use client";

import { useRouter } from "next/navigation";
import RoundButton from "@/components/RoundButton";
import { searchFocus } from "@/lib/searchFocus";

export default function ScopeSearchButton({ scope }: { scope: "watched" | "watchlist" }) {
  const router = useRouter();
  // `at` makes each tap count once, so coming back to Search with Back keeps the filters set since.
  return <RoundButton icon="search" label={scope === "watched" ? "Search what you have watched" : "Search your Watchlist"} onClick={() => {
    // Raises the keyboard during the tap itself, as Home's search pill does, so Search opens ready to type.
    searchFocus.prime();
    router.push(`/search/?in=${scope}&at=${Date.now()}`);
  }} />;
}
