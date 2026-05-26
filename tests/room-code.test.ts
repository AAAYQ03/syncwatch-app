import { describe, it, expect } from "vitest";
import {
  generateRoomCode,
  isRoomCode,
  parseRoomCodeInput,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH
} from "@/lib/room-code";

describe("generateRoomCode", () => {
  it("produces a code of the configured length", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("only uses characters from the alphabet", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateRoomCode();
      for (const ch of code) {
        expect(ROOM_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it("is deterministic when given a seeded RNG", () => {
    const seq = [0.1, 0.5, 0.9, 0.2, 0.7, 0.3];
    const makeRng = () => {
      let i = 0;
      return () => seq[i++ % seq.length]!;
    };
    expect(generateRoomCode(6, makeRng())).toBe(generateRoomCode(6, makeRng()));
  });

  it("has reasonable uniqueness over small batches", () => {
    const set = new Set<string>();
    for (let i = 0; i < 500; i += 1) set.add(generateRoomCode());
    // 30^6 ≈ 7.3e8; 500 draws should be unique with overwhelming probability.
    expect(set.size).toBe(500);
  });
});

describe("isRoomCode", () => {
  it("accepts valid codes", () => {
    expect(isRoomCode("ABCDEF")).toBe(true);
    expect(isRoomCode("23456J")).toBe(true);
  });

  it("rejects codes with ambiguous chars or wrong length", () => {
    expect(isRoomCode("ABCDE0")).toBe(false); // 0 excluded
    expect(isRoomCode("ABCDE1")).toBe(false); // 1 excluded
    expect(isRoomCode("ABCDEI")).toBe(false); // I excluded
    expect(isRoomCode("ABCDE")).toBe(false);  // too short
    expect(isRoomCode("ABCDEFG")).toBe(false);
  });
});

describe("parseRoomCodeInput", () => {
  it("parses a raw code", () => {
    expect(parseRoomCodeInput("abcdef")).toBe("ABCDEF");
    expect(parseRoomCodeInput("  ABCDEF ")).toBe("ABCDEF");
  });

  it("extracts a code from a URL", () => {
    expect(
      parseRoomCodeInput("https://syncwatch.app/room/ABCDEF/lobby")
    ).toBe("ABCDEF");
  });

  it("returns null for invalid input", () => {
    expect(parseRoomCodeInput("")).toBeNull();
    expect(parseRoomCodeInput("nope")).toBeNull();
    expect(parseRoomCodeInput("https://example.com")).toBeNull();
  });
});
