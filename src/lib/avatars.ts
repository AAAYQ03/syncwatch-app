export const ALL_AVATARS = [
  "cat",
  "dog",
  "fox",
  "panda",
  "bear",
  "owl",
  "rabbit",
  "frog"
] as const;

export type AvatarId = (typeof ALL_AVATARS)[number];

/** Return the first `size` avatars from the master list. */
export function buildAvatarPool(size: number): string[] {
  const clamped = Math.max(2, Math.min(size, ALL_AVATARS.length));
  return ALL_AVATARS.slice(0, clamped);
}
