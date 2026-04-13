// 6-char human-friendly room code.
// Alphabet excludes visually ambiguous characters: 0/O, 1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateRoomCode(
  length: number = CODE_LENGTH,
  randomFn: () => number = Math.random
): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(randomFn() * ALPHABET.length);
    out += ALPHABET.charAt(idx);
  }
  return out;
}

export function isRoomCode(value: string): boolean {
  if (value.length !== CODE_LENGTH) return false;
  for (const ch of value) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Parse a user-supplied string (raw code OR a full SyncWatch URL) into a
 * normalized room code, or null if unrecognized.
 */
export function parseRoomCodeInput(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;

  // Raw code
  if (isRoomCode(trimmed)) return trimmed;

  // Look for `/room/CODE` path segment first (most specific).
  const roomPath = trimmed.match(/\/ROOM\/([A-Z0-9]{6})(?:[/?#]|$)/);
  if (roomPath && roomPath[1] && isRoomCode(roomPath[1])) {
    return roomPath[1];
  }

  // Fall back to any 6-char token on a path/query boundary.
  const boundaryMatches = trimmed.match(/(?:^|[/?#=])([A-Z0-9]{6})(?:[/?#]|$)/g);
  if (boundaryMatches) {
    for (const raw of boundaryMatches) {
      const candidate = raw.replace(/[^A-Z0-9]/g, "");
      if (isRoomCode(candidate)) return candidate;
    }
  }
  return null;
}

export { ALPHABET as ROOM_CODE_ALPHABET, CODE_LENGTH as ROOM_CODE_LENGTH };
