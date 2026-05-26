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

export const AVATAR_EMOJI: Record<string, string> = {
  cat: "🐱",
  dog: "🐶",
  fox: "🦊",
  panda: "🐼",
  bear: "🐻",
  owl: "🦉",
  rabbit: "🐰",
  frog: "🐸",
  "?": "❓"
};

export function avatarEmoji(id: string): string {
  return AVATAR_EMOJI[id] ?? "❓";
}

/** Return the first `size` avatars from the master list. */
export function buildAvatarPool(size: number): string[] {
  const clamped = Math.max(2, Math.min(size, ALL_AVATARS.length));
  return ALL_AVATARS.slice(0, clamped);
}
