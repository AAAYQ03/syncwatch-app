"use client";

import { useEffect, useRef, useState } from "react";
import { parseVideoUrl } from "@/lib/video-url";

type Preview = {
  provider: "youtube" | "bilibili";
  url: string;
  title: string;
  author: string | null;
  thumbnail: string | null;
};

type Props = {
  onSetVideo: (args: { video_url: string; video_title: string }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  currentUrl: string | null;
};

const DEBOUNCE_MS = 350;

export function VideoUrlInput({ onSetVideo, currentUrl }: Props) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reqIdRef = useRef(0);

  // Debounced preview fetch
  useEffect(() => {
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }
    // Cheap client-side check before paying for a server round-trip.
    if (!parseVideoUrl(trimmed)) {
      setPreview(null);
      setLoadingPreview(false);
      setError("Paste a YouTube or Bilibili link.");
      return;
    }

    setLoadingPreview(true);
    const myReq = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/video-info?url=${encodeURIComponent(trimmed)}`,
          { cache: "no-store" }
        );
        if (myReq !== reqIdRef.current) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as Preview;
        if (myReq !== reqIdRef.current) return;
        setPreview(data);
      } catch (err) {
        if (myReq !== reqIdRef.current) return;
        setPreview(null);
        setError(err instanceof Error ? err.message : "Couldn't fetch title");
      } finally {
        if (myReq === reqIdRef.current) setLoadingPreview(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input]);

  async function handleSubmit() {
    if (!preview || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await onSetVideo({
      video_url: preview.url,
      video_title: preview.title
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Failed to set video");
      return;
    }
    setInput("");
    setPreview(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <h2 className="text-lg font-semibold">Set video</h2>
      {currentUrl && (
        <p className="text-xs text-neutral-500">
          Currently playing:{" "}
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-300 hover:underline"
          >
            {currentUrl}
          </a>
        </p>
      )}
      <input
        type="url"
        inputMode="url"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=... or https://www.bilibili.com/video/BV..."
        className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-50 outline-none focus:border-neutral-500"
      />

      {loadingPreview && (
        <p className="text-sm text-neutral-400">Fetching title…</p>
      )}

      {preview && (
        <div className="flex items-start gap-3 rounded-md border border-neutral-800 bg-neutral-950 p-3">
          {preview.thumbnail && (
            // External-thumbnail: use img instead of next/image to skip remote-pattern config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnail}
              alt=""
              className="h-16 w-28 rounded object-cover"
            />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-100">
              {preview.title}
            </p>
            {preview.author && (
              <p className="text-xs text-neutral-400">{preview.author}</p>
            )}
            <p className="mt-1 text-xs text-neutral-500 capitalize">
              {preview.provider}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!preview || submitting}
        className="rounded-md bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Setting…" : "Set video for everyone"}
      </button>
    </div>
  );
}
