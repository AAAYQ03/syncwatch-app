import { describe, it, expect } from "vitest";
import {
  canStartCountdown,
  readyBlockReason,
  isPickInPool,
  MIN_MEMBERS_TO_START,
  RELEASED_AVATAR
} from "@/lib/lobby-rules";

const ready = (n: number) =>
  Array.from({ length: n }, () => ({ is_ready: true }));
const mixed = (readyN: number, notReadyN: number) => [
  ...Array.from({ length: readyN }, () => ({ is_ready: true })),
  ...Array.from({ length: notReadyN }, () => ({ is_ready: false }))
];

describe("canStartCountdown — Bug Report #2 regression", () => {
  it("returns false for an empty room", () => {
    expect(canStartCountdown([])).toBe(false);
  });

  it("returns false for a solo ready user (Bug #19 fix)", () => {
    expect(canStartCountdown(ready(1))).toBe(false);
  });

  it("returns false when 2 members but one isn't ready", () => {
    expect(canStartCountdown(mixed(1, 1))).toBe(false);
  });

  it("returns true when 2 members are all ready", () => {
    expect(canStartCountdown(ready(MIN_MEMBERS_TO_START))).toBe(true);
  });

  it("returns true when 4 members are all ready", () => {
    expect(canStartCountdown(ready(4))).toBe(true);
  });

  it("returns false when 4 members but one isn't ready", () => {
    expect(canStartCountdown(mixed(3, 1))).toBe(false);
  });
});

describe("isPickInPool — Yewen PR #14 review point 3", () => {
  const pool = ["cat", "dog", "fox", "panda"];

  it("accepts pool members", () => {
    expect(isPickInPool("cat", pool)).toBe(true);
    expect(isPickInPool("panda", pool)).toBe(true);
  });

  it("rejects ids outside the pool", () => {
    expect(isPickInPool("dragon", pool)).toBe(false);
    expect(isPickInPool("CAT", pool)).toBe(false); // case-sensitive
    expect(isPickInPool("", pool)).toBe(false);
  });

  it("always accepts the released sentinel", () => {
    expect(isPickInPool(RELEASED_AVATAR, pool)).toBe(true);
    expect(isPickInPool(RELEASED_AVATAR, [])).toBe(true);
  });
});

describe("readyBlockReason", () => {
  it("asks for more players when the room is solo", () => {
    expect(readyBlockReason(ready(1))).toMatch(/at least one more player/);
  });

  it("asks for the right count when 0 players", () => {
    expect(readyBlockReason([])).toMatch(/2 more players/);
  });

  it("calls out unready players when the room has enough members", () => {
    expect(readyBlockReason(mixed(2, 1))).toMatch(/1 player to be ready/);
    expect(readyBlockReason(mixed(1, 2))).toMatch(/2 players to be ready/);
  });

  it("returns null when everyone is ready and the threshold is met", () => {
    expect(readyBlockReason(ready(2))).toBeNull();
  });
});
