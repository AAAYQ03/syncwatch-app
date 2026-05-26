# Security Review

Last updated: 2026-05-04 · Owner: developer (Youqian Cui)

This document captures the project's threat model, secret-handling rules, and the automated + manual checks we run to keep credentials and user data safe.

## 1. Threat model (brief)

SyncWatch is an anonymous-session web app — no login, no PII, no payment data. The realistic risks are:

| Category | Concern | Mitigation |
|---|---|---|
| Leaked secrets in git | Supabase keys, Vercel tokens, GitHub PATs accidentally committed | `.gitignore`, `.env.example` (placeholder only), automated TruffleHog scan in CI (`security-scan.yml`) |
| SSRF via `/api/video-info` | Server fetches arbitrary URL on user input | Strict allowlist parser (`src/lib/video-url.ts`) — only `youtube.com`, `youtu.be`, `m.youtube.com`, `bilibili.com`, `m.bilibili.com`. https/http only. URL length capped (1000). 4s upstream fetch timeout |
| XSS via video title / room name | User-controlled strings render in DOM | React's default JSX escaping; no `dangerouslySetInnerHTML` anywhere; titles sourced from oEmbed/Bilibili API and Zod-validated lengths |
| SQL injection via room code | User-supplied input hits DB | Supabase JS client parameterizes all queries; Zod validates UUIDs and 6-char alphabet before query |
| Realtime channel abuse | Anyone could broadcast spoofed events on a `room:{id}` channel | Tradeoff accepted for an anonymous demo — every payload carries `sender` (session_id); receivers ignore their own; UI displays the sender's avatar. A malicious peer can spam but cannot impersonate or DOS at this scale |
| Anon key exposure | `NEXT_PUBLIC_SUPABASE_ANON_KEY` is in the client bundle | This is **by design**. The key is meant to be public; row-level security policies in `supabase/migrations/0001_init.sql` are the actual access control |

Out of scope (and why): user authentication / account takeover (no accounts); cross-tenant data isolation (no tenants); rate limiting (relying on Vercel/Supabase defaults for demo scale).

## 2. What counts as a secret

- ✅ Safe to commit: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key) — both are designed to ship in the browser bundle.
- ❌ **Never commit**:
  - Supabase `service_role` key (full DB access, bypasses RLS) — prefix `sb_secret_*` or legacy JWT starting with `eyJ...` that has `"role":"service_role"`.
  - Supabase database password (the one you set when creating the project).
  - Vercel deploy tokens, fine-grained PATs (e.g. `DEPLOY_MIRROR_TOKEN`).
  - GitHub personal access tokens (`ghp_*`, `github_pat_*`).
  - Any third-party API keys we add later (Stripe, OpenAI, etc.).

If you accidentally commit a real secret: **revoke it first** (Supabase Dashboard → Settings → API → Reset; GitHub → Settings → Developer settings → revoke PAT), then rewrite history with `git filter-repo` or BFG. Removing the file in a new commit is **not enough** — the secret is preserved in history.

## 3. Automated checks

| Check | When it runs | Where |
|---|---|---|
| **Lint, typecheck, test** | every push, every PR | `.github/workflows/ci.yml` |
| **Secret scan (TruffleHog OSS, verified-only)** | every push, every PR, weekly cron | `.github/workflows/security-scan.yml` |
| **Security-focused unit tests** | every `pnpm test` run | `tests/security.test.ts` covers SSRF host/scheme defense + `.env.example` regression |

TruffleHog runs in `--only-verified` mode, which means it will only fail the build for *active, working* credentials (not random base64 blobs that look key-ish). This keeps the signal-to-noise ratio high.

## 4. Manual review checklist

Run through this list before any release / before sending a PR to review:

- [ ] `git ls-files | xargs grep -l "sb_secret_\|service_role"` returns empty
- [ ] `git ls-files | xargs grep -lE "(sk_live_|xox[bp]-|AIza[A-Za-z0-9_-]{35}|ghp_[A-Za-z0-9]{36})"` returns empty
- [ ] `cat .env.example` contains only placeholder values (no real URLs/keys)
- [ ] `cat .gitignore` includes `.env.local`, `.env*.local`, `.vercel/`
- [ ] CI `security-scan` job is green for the latest commit
- [ ] Any new API route that calls `fetch()` validates the URL against an allowlist (see `src/app/api/video-info/route.ts` for the pattern)
- [ ] Any new user-controlled string rendered into the DOM uses plain JSX (no `dangerouslySetInnerHTML`)
- [ ] Any new env var has a placeholder line added to `.env.example`

## 5. Reporting a vulnerability

This is a course project, not a production service. If you find something serious, open a GitHub Issue and tag the developer (@AAAYQ03).
