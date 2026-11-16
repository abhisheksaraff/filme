// hooks/useStoryMusic.ts
// Soft background music for a story. It starts only after a tap (phones do not allow sound before one) and
// plays through a volume control, so it stays quiet even when the phone's volume is up. A track whose server
// does not allow that is skipped rather than played loudly.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaTrack } from "@/lib/ports/media";
import { clearPreloaded, takePreloaded } from "@/lib/storyAudio";

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
  /** Set when the story closes, so a track that finishes loading afterwards never starts. */
  const closed = useRef(false);
  /** The address already set on the element by the preload, so it is not set again. */
  const preSrc = useRef<string | null>(null);

  const tryTrack = useCallback((first: number) => {
    const el = audio.current;
    if (!el) return;
    // Each track that cannot be loaded or played passes on to the next.
    const attempt = (i: number): void => {
      if (i >= tracks.length || closed.current) return;
      if (preSrc.current !== tracks[i].url) el.src = tracks[i].url;
      el.onerror = () => {
        attempt(i + 1);
      };
      el.play().then(() => {
        if (closed.current) {
          el.pause();
          return;
        }
        const ctx = context.current;
        if (ctx && gain.current) gain.current.gain.setTargetAtTime(VOLUME, ctx.currentTime, 1.2);
        setPlaying(tracks[i]);
      }).catch(() => {
        attempt(i + 1);
      });
    };
    attempt(first);
  }, [tracks]);

  const start = useCallback(() => {
    if (tracks.length === 0 || started.current) return;
    started.current = true;
    if (!audio.current) {
      const pre = takePreloaded(tracks);
      const el = pre?.el ?? new Audio();
      preSrc.current = pre ? pre.track.url : null;
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
    // Starts with the track that was downloaded ahead, if there was one.
    const first = preSrc.current ? tracks.findIndex((t) => t.url === preSrc.current) : 0;
    tryTrack(Math.max(0, first));
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

  // Closing the story ends its music for good, including a track that was still loading.
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      started.current = false;
      audio.current?.pause();
      void context.current?.close();
      audio.current = null;
      context.current = null;
      gain.current = null;
      clearPreloaded();
    };
  }, []);

  return { available: tracks.length > 0, on, playing, toggle, touch };
}
