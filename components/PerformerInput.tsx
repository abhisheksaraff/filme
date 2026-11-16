// components/PerformerInput.tsx
// Adds performers and openers to a concert or live event, with MusicBrainz suggestions.
"use client";

import ProblemPopup from "@/components/ProblemPopup";
import { FIELD } from "@/components/ui/fields";
import { useEffect, useState } from "react";
import { addPerformer } from "@/lib/credits";
import type { ArtistHit } from "@/lib/ports/artists";
import { services } from "@/lib/services";

interface Props {
  mediaId: string;
  onAdded: () => void;
}

export default function PerformerInput({ mediaId, onAdded }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"performer" | "opener">("performer");
  const [hits, setHits] = useState<ArtistHit[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  // Wait for a pause in typing so MusicBrainz is not asked on every keystroke.
  useEffect(() => {
    const query = name.trim();
    if (query.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      services.artists.search(query).then((res) => {
        if (!cancelled) setHits(res.ok ? res.value : []);
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name]);

  async function add(label: string, musicbrainzId: string | null) {
    setProblem(null);
    const res = await addPerformer(mediaId, { name: label, musicbrainzId }, role);
    if (!res.ok) return setProblem(res.error);
    setName("");
    setHits([]);
    onAdded();
  }

  const field = FIELD;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an artist" maxLength={120} className={`${field} flex-1`} />
        <select value={role} onChange={(e) => setRole(e.target.value as "performer" | "opener")} className={field} aria-label="Role">
          <option value="performer">Performer</option>
          <option value="opener">Opener</option>
        </select>
      </div>
      <ProblemPopup message={problem} onClose={() => setProblem(null)} />
      {name.trim().length >= 2 && (
        <ul className="flex flex-col gap-1 text-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => add(hit.name, hit.id)} className="press flex w-full flex-col px-2 py-1.5 text-left">
                <span className="font-medium">{hit.name}</span>
                {hit.note && <span className="text-xs text-neutral-500">{hit.note}</span>}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => add(name.trim(), null)} className="rounded-xl px-2 py-1.5 text-left text-neutral-500">
              Add “{name.trim()}” as typed
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
