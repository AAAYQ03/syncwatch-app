import { NextResponse } from "next/server";
import { z } from "zod";
import { parseVideoUrl, type ParsedVideo } from "@/lib/video-url";

export const runtime = "nodejs";

const QuerySchema = z.object({
  url: z.string().min(1).max(1000)
});

const FETCH_TIMEOUT_MS = 4000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parseResult = QuerySchema.safeParse({
    url: searchParams.get("url") ?? ""
  });
  if (!parseResult.success) {
    return NextResponse.json({ error: "Missing or invalid url" }, { status: 400 });
  }

  // SSRF defense: reject anything we can't recognize. The parser only
  // accepts https/http URLs on a fixed host whitelist (YouTube/Bilibili).
  const parsed = parseVideoUrl(parseResult.data.url);
  if (!parsed) {
    return NextResponse.json(
      { error: "Unsupported URL. SyncWatch supports YouTube and Bilibili." },
      { status: 400 }
    );
  }

  try {
    const info = await fetchVideoInfo(parsed);
    return NextResponse.json({
      provider: parsed.provider,
      id: parsed.id,
      url: parsed.canonicalUrl,
      title: info.title,
      author: info.author ?? null,
      thumbnail: info.thumbnail ?? null
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch video info"
      },
      { status: 502 }
    );
  }
}

type VideoInfo = {
  title: string;
  author?: string;
  thumbnail?: string;
};

async function fetchVideoInfo(parsed: ParsedVideo): Promise<VideoInfo> {
  if (parsed.provider === "youtube") return fetchYouTubeInfo(parsed.canonicalUrl);
  return fetchBilibiliInfo(parsed.id);
}

async function fetchYouTubeInfo(url: string): Promise<VideoInfo> {
  // YouTube oEmbed: public, no auth, no rate-limit headers documented.
  const oembed = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  const data = await fetchJson(oembed);
  const title = pickString(data, "title");
  if (!title) throw new Error("YouTube oEmbed returned no title");
  return {
    title,
    author: pickString(data, "author_name") ?? undefined,
    thumbnail: pickString(data, "thumbnail_url") ?? undefined
  };
}

async function fetchBilibiliInfo(bvid: string): Promise<VideoInfo> {
  // Bilibili web API. Public; returns code: 0 on success.
  const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
  const data = await fetchJson(apiUrl);
  if (typeof data !== "object" || data === null) {
    throw new Error("Bilibili API returned malformed response");
  }
  const code = (data as { code?: unknown }).code;
  if (code !== 0) {
    const msg = pickString(data, "message") ?? `code ${String(code)}`;
    throw new Error(`Bilibili API error: ${msg}`);
  }
  const inner = (data as { data?: unknown }).data;
  if (typeof inner !== "object" || inner === null) {
    throw new Error("Bilibili API: missing data");
  }
  const title = pickString(inner, "title");
  if (!title) throw new Error("Bilibili API: missing title");
  const owner = (inner as { owner?: unknown }).owner;
  const author =
    typeof owner === "object" && owner !== null
      ? pickString(owner, "name") ?? undefined
      : undefined;
  return {
    title,
    author,
    thumbnail: pickString(inner, "pic") ?? undefined
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // A UA helps Bilibili's API not return empty payloads.
        "User-Agent": "SyncWatch/0.1 (+https://syncwatch.app)",
        Accept: "application/json"
      },
      redirect: "follow"
    });
    if (!res.ok) {
      throw new Error(`Upstream ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickString(obj: unknown, key: string): string | null {
  if (typeof obj !== "object" || obj === null) return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
