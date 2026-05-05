"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadYouTubeApi } from "@/lib/youtube-api";
import { parseVideoUrl } from "@/lib/video-url";

export type PlayerStatus = "playing" | "paused" | "buffering" | "ended" | "unstarted";

export type PlayerHandle = {
  play: () => void;
  pause: () => void;
  /** Seek to absolute seconds. */
  seek: (seconds: number) => void;
  getCurrentTime: () => number;
  getStatus: () => PlayerStatus;
};

type Props = {
  videoUrl: string;
  /** Fired the first time the underlying player is ready to take commands. */
  onReady?: (handle: PlayerHandle) => void;
  /** State changes coming from the player itself (user click or system). */
  onPlayerEvent?: (event: { type: "play" | "pause" | "seek-end" | "buffering" | "playing"; currentTime: number }) => void;
};

const YT_DOM_ID_PREFIX = "yt-player-";

export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer(
  { videoUrl, onReady, onPlayerEvent },
  ref
) {
  const parsed = parseVideoUrl(videoUrl);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YT.Player | null>(null);
  const handleRef = useRef<PlayerHandle | null>(null);
  const lastReportedSeekRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Imperative API exposed to parent.
  useImperativeHandle(ref, (): PlayerHandle => {
    return (
      handleRef.current ?? {
        play: () => {},
        pause: () => {},
        seek: () => {},
        getCurrentTime: () => 0,
        getStatus: () => "unstarted"
      }
    );
  }, []);

  // YouTube player lifecycle.
  useEffect(() => {
    if (!parsed || parsed.provider !== "youtube") return;
    if (!containerRef.current) return;

    let cancelled = false;
    setError(null);

    const domId = `${YT_DOM_ID_PREFIX}${parsed.id}`;
    // The IFrame API replaces the target element entirely.
    containerRef.current.innerHTML = `<div id="${domId}"></div>`;

    loadYouTubeApi().then((YTApi) => {
      if (cancelled || !containerRef.current) return;
      ytPlayerRef.current = new YTApi.Player(domId, {
        videoId: parsed.id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1
        },
        events: {
          onReady: (e) => {
            const player = e.target;
            const handle: PlayerHandle = {
              play: () => player.playVideo(),
              pause: () => player.pauseVideo(),
              seek: (seconds) => {
                lastReportedSeekRef.current = seconds;
                player.seekTo(seconds, true);
              },
              getCurrentTime: () => {
                try {
                  return player.getCurrentTime();
                } catch {
                  return 0;
                }
              },
              getStatus: () => mapState(player.getPlayerState())
            };
            handleRef.current = handle;
            onReady?.(handle);
          },
          onStateChange: (e) => {
            const player = e.target;
            const status = mapState(e.data);
            const currentTime = player.getCurrentTime();
            if (status === "playing") {
              onPlayerEvent?.({ type: "play", currentTime });
              // Detect a user-initiated seek: if currentTime jumped relative to
              // our last set seek, surface as seek-end.
              if (
                Math.abs(currentTime - lastReportedSeekRef.current) > 1.5 &&
                lastReportedSeekRef.current !== 0
              ) {
                onPlayerEvent?.({ type: "seek-end", currentTime });
              }
              lastReportedSeekRef.current = currentTime;
            } else if (status === "paused") {
              onPlayerEvent?.({ type: "pause", currentTime });
            } else if (status === "buffering") {
              onPlayerEvent?.({ type: "buffering", currentTime });
            }
          },
          onError: () => setError("Video failed to load")
        }
      });
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load YouTube API");
    });

    return () => {
      cancelled = true;
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // ignore
      }
      ytPlayerRef.current = null;
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.id, parsed?.provider]);

  if (!parsed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/60 text-sm text-neutral-500">
        Unsupported video URL
      </div>
    );
  }

  if (parsed.provider === "bilibili") {
    return (
      <div className="flex flex-col gap-2">
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <iframe
            title="Bilibili video"
            src={`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(parsed.id)}&autoplay=0&high_quality=1`}
            allow="autoplay; fullscreen"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <p className="text-xs text-neutral-500">
          Bilibili sync is best-effort: programmatic playback control isn&apos;t
          publicly supported, so play/pause/seek may not mirror across viewers.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="aspect-video w-full overflow-hidden rounded-2xl bg-black"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
});

function mapState(state: YT.PlayerState | number): PlayerStatus {
  switch (state) {
    case 1:
      return "playing";
    case 2:
      return "paused";
    case 3:
      return "buffering";
    case 0:
      return "ended";
    case -1:
    case 5:
    default:
      return "unstarted";
  }
}
