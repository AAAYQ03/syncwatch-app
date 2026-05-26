import { describe, it, expect } from "vitest";
import { parseVideoUrl } from "@/lib/video-url";

describe("parseVideoUrl — YouTube", () => {
  it("parses standard watch URL", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "youtube",
      id: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    });
  });

  it("parses watch URL with extra query params", () => {
    const r = parseVideoUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&list=PL123"
    );
    expect(r?.id).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be short URL", () => {
    const r = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?si=abc");
    expect(r?.id).toBe("dQw4w9WgXcQ");
  });

  it("parses /shorts URL", () => {
    expect(parseVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.id).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("parses m.youtube.com", () => {
    expect(parseVideoUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")?.id).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("rejects malformed YouTube IDs", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=way_too_long_id123")).toBeNull();
  });
});

describe("parseVideoUrl — Bilibili", () => {
  it("parses /video/BVxxxx URL", () => {
    expect(parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7")).toEqual({
      provider: "bilibili",
      id: "BV1GJ411x7h7",
      canonicalUrl: "https://www.bilibili.com/video/BV1GJ411x7h7"
    });
  });

  it("parses with trailing slash and query", () => {
    expect(
      parseVideoUrl("https://www.bilibili.com/video/BV1GJ411x7h7/?p=1")?.id
    ).toBe("BV1GJ411x7h7");
  });

  it("rejects non-BV ids", () => {
    expect(parseVideoUrl("https://www.bilibili.com/video/av12345")).toBeNull();
  });
});

describe("parseVideoUrl — invalid", () => {
  it.each([
    "",
    "not a url",
    "https://example.com/video/BV1GJ411x7h7",
    "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.com.youtube.com/watch?v=dQw4w9WgXcQ"
  ])("returns null for %s", (input) => {
    expect(parseVideoUrl(input)).toBeNull();
  });
});
