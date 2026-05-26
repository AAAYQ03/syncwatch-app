// Security-focused unit tests. These exist on top of the existing 24 tests
// to make the security contract explicit and regression-resistant. See
// SECURITY.md §3 for the broader review pipeline.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseVideoUrl } from "@/lib/video-url";

const repoRoot = join(__dirname, "..");

describe("SSRF defense — /api/video-info host & scheme allowlist", () => {
  // The video-info route fans out a server-side fetch based on user input.
  // The URL parser IS the allowlist; only YouTube/Bilibili over http(s) pass.
  it("rejects non-http(s) schemes that could target internal services", () => {
    for (const url of [
      "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "file:///etc/passwd",
      "gopher://internal.svc/x",
      "data:text/html,<script>alert(1)</script>",
      "javascript:alert(1)"
    ]) {
      expect(parseVideoUrl(url)).toBeNull();
    }
  });

  it("rejects look-alike hosts (subdomain & suffix confusion)", () => {
    // Classic phishing tricks that a naive `host.endsWith("youtube.com")`
    // would accept. Our exact-set check via URL().hostname rejects them.
    for (const url of [
      "https://evil.com.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "https://www-youtube.com/watch?v=dQw4w9WgXcQ",
      "https://yotube.com/watch?v=dQw4w9WgXcQ",
      "https://bilibili.com.attacker.io/video/BV1GJ411x7h7"
    ]) {
      expect(parseVideoUrl(url)).toBeNull();
    }
  });
});

describe(".env.example regression", () => {
  // Belt-and-suspenders against accidentally committing a real key by editing
  // .env.example. TruffleHog runs in CI for verified secrets; this catches
  // the moment of authorship locally before commit.
  const path = join(repoRoot, ".env.example");

  it("exists at the repo root", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("contains only placeholder values, not real-looking secrets", () => {
    const raw = readFileSync(path, "utf8");
    const lines = raw
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"));

    expect(lines.length).toBeGreaterThan(0);

    // Patterns that strongly indicate a real Supabase / generic credential.
    const realKeyPatterns = [
      /sb_secret_[A-Za-z0-9_-]{10,}/, // Supabase service-role key
      /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, // JWT
      /sk_live_[A-Za-z0-9]{20,}/, // Stripe live secret
      /xox[bp]-[A-Za-z0-9-]{20,}/, // Slack token
      /AIza[A-Za-z0-9_-]{35}/, // Google API key
      /ghp_[A-Za-z0-9]{36}/ // GitHub PAT (classic)
    ];

    for (const line of lines) {
      const [, value] = line.split("=", 2);
      if (!value) continue;
      const trimmed = value.trim().replace(/^["']|["']$/g, "");
      for (const pat of realKeyPatterns) {
        expect(
          pat.test(trimmed),
          `Real-looking secret detected in .env.example on line: ${line}`
        ).toBe(false);
      }
      // A real Supabase project ref is a 20-char lowercase alphanumeric.
      // Placeholders must NOT match this shape; we look for "YOUR" markers.
      if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL")) {
        expect(
          /YOUR|EXAMPLE|REF/i.test(trimmed),
          `Supabase URL placeholder in .env.example looks real: ${trimmed}`
        ).toBe(true);
      }
    }
  });
});
