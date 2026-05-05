// Parse YouTube and Bilibili video URLs into a normalized shape.
// We only accept the providers SyncWatch can embed.

export type VideoProvider = "youtube" | "bilibili";

export type ParsedVideo = {
  provider: VideoProvider;
  id: string;
  /** Canonical watch URL we'll persist & embed. */
  canonicalUrl: string;
};

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

const BILIBILI_HOSTS = new Set([
  "www.bilibili.com",
  "bilibili.com",
  "m.bilibili.com"
]);

/** Quasi-strict YouTube ID: 11 chars of [A-Za-z0-9_-]. */
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
/** Bilibili BV id: BV + 10 chars of base58-ish alphabet. */
const BV_ID_RE = /^BV[A-Za-z0-9]{10}$/;

export function parseVideoUrl(input: string): ParsedVideo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const id = extractYoutubeId(url);
    if (!id) return null;
    return {
      provider: "youtube",
      id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`
    };
  }

  if (BILIBILI_HOSTS.has(host)) {
    const id = extractBilibiliId(url);
    if (!id) return null;
    return {
      provider: "bilibili",
      id,
      canonicalUrl: `https://www.bilibili.com/video/${id}`
    };
  }

  return null;
}

function extractYoutubeId(url: URL): string | null {
  // youtu.be/<id>
  if (url.hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YT_ID_RE.test(id) ? id : null;
  }
  // youtube.com/watch?v=<id>
  const v = url.searchParams.get("v");
  if (v && YT_ID_RE.test(v)) return v;

  // youtube.com/shorts/<id>, /embed/<id>, /live/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const [bucket, id] = segments;
    if (bucket && id && ["shorts", "embed", "live", "v"].includes(bucket) && YT_ID_RE.test(id)) {
      return id;
    }
  }
  return null;
}

function extractBilibiliId(url: URL): string | null {
  // /video/<bvid>
  const segments = url.pathname.split("/").filter(Boolean);
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (segments[i] === "video") {
      const id = segments[i + 1];
      if (id && BV_ID_RE.test(id)) return id;
    }
  }
  // last-segment fallback
  const last = segments[segments.length - 1];
  if (last && BV_ID_RE.test(last)) return last;
  return null;
}
