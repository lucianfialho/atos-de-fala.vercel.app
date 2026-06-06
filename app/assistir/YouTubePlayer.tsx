"use client";

import { useEffect, useRef } from "react";

// Minimal handle the page uses to read time / control playback.
export type PlayerHandle = {
  getCurrentTime: () => number;
  seekTo: (s: number) => void;
  pause: () => void;
  play: () => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Load the IFrame API script once; resolve when window.YT is ready.
let apiPromise: Promise<any> | null = null;
function loadYT(): Promise<any> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export default function YouTubePlayer({
  videoId,
  onReady,
}: {
  videoId: string;
  onReady: (handle: PlayerHandle) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            const p = playerRef.current;
            onReadyRef.current({
              getCurrentTime: () => p?.getCurrentTime?.() ?? 0,
              seekTo: (s: number) => p?.seekTo?.(s, true),
              pause: () => p?.pauseVideo?.(),
              play: () => p?.playVideo?.(),
            });
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [videoId]);

  return (
    <div className="yt-frame">
      <div ref={hostRef} />
    </div>
  );
}
