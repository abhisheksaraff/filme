// hooks/useStoryMusic.ts
// Soft background music for a story. It starts only after a tap (phones do not allow sound before one) and
// plays through a volume control, so it stays quiet even when the phone's volume is up. A track whose server
// does not allow that is skipped rather than played loudly.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { debugLog } from "@/lib/debug";
import type { MediaTrack } from "@/lib/ports/media";

const PREF = "filme-story-sound";
/** A fraction of full volume. */
const VOLUME = 0.16;

const wanted = () => {
  try {
    return localStorage.getItem(PREF) === "on";
  } catch {
    return false;
  }
};

export function useStoryMusic(tracks: MediaTrack[]) {
  const [on, setOn] = useState(wanted);
  const [playing, setPlaying] = useState<MediaTrack | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const context = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const started = useRef(false);

  const tryTrack = useCallback((first: number) => {
    const el = audio.current;
    if (!el) return;
    // Each track that cannot be loaded or played passes on to the next.
    const attempt = (i: number): void => {
      if (i >= tracks.length) return;
      el.src = tracks[i].url;
      el.onerror = () => {
        debugLog(`track ${i + 1} could not load (${new URL(tracks[i].url).host})`);
        attempt(i + 1);
      };
      el.play().then(() => {
        const ctx = context.current;
        if (ctx && gain.current) gain.current.gain.setTargetAtTime(VOLUME, ctx.currentTime, 1.2);
        debugLog(`track ${i + 1} playing`);
        setPlaying(tracks[i]);
      }).catch((e) => {
        debugLog(`track ${i + 1} refused: ${e instanceof Error ? e.name : "error"}`);
        attempt(i + 1);
      });
    };
    attempt(first);
  }, [tracks]);

  const start = useCallback(() => {
    if (tracks.length === 0 || started.current) return;
    started.current = true;
    if (!audio.current) {
      const el = new Audio();
      // Without the server's permission the browser would play it silently through the volume control, so it errors instead and the next track is tried.
      el.crossOrigin = "anonymous";
      el.loop = true;
      audio.current = el;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const node = ctx.createGain();
      node.gain.value = 0;
      ctx.createMediaElementSource(el).connect(node);
      node.connect(ctx.destination);
      context.current = ctx;
      gain.current = node;
    }
    void context.current?.resume();
    tryTrack(0);
  }, [tracks, tryTrack]);

  const stop = useCallback(() => {
    started.current = false;
    audio.current?.pause();
    if (context.current && gain.current) gain.current.gain.value = 0;
    setPlaying(null);
  }, []);

  /** The speaker button. Must run inside the tap so the phone lets the sound start. */
  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(PREF, next ? "on" : "off");
    } catch {
      // The choice is just not remembered.
    }
    if (next) start();
    else stop();
  }, [on, start, stop]);

  /** Any tap on the story: a remembered "on" starts the music with the first one. */
  const touch = useCallback(() => {
    if (on) start();
  }, [on, start]);

  useEffect(() => () => {
    audio.current?.pause();
    void context.current?.close();
  }, []);

  return { available: tracks.length > 0, on, playing, toggle, touch };
}
