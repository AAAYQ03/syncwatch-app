// Pure rules for when the lobby should advance to the watch room.
// Extracted so it's unit-testable and easy to tune.

export const MIN_MEMBERS_TO_START = 2;

type ReadyLike = { is_ready: boolean };

/**
 * The countdown should only fire when the room is genuinely multiplayer
 * AND everyone present has clicked Ready.
 *
 * Single-user "Ready" must not trigger countdown — that defeats the
 * purpose of a watch-together app (Bug Report #2 / Issue #19).
 */
export function canStartCountdown(members: ReadyLike[]): boolean {
  if (members.length < MIN_MEMBERS_TO_START) return false;
  return members.every((m) => m.is_ready);
}

/**
 * UI hint for the ready panel — explains why the countdown isn't firing.
 */
export function readyBlockReason(members: ReadyLike[]): string | null {
  if (members.length < MIN_MEMBERS_TO_START) {
    const needed = MIN_MEMBERS_TO_START - members.length;
    return needed === 1
      ? "Waiting for at least one more player to join…"
      : `Waiting for ${needed} more players to join…`;
  }
  if (!members.every((m) => m.is_ready)) {
    const notReady = members.filter((m) => !m.is_ready).length;
    return notReady === 1
      ? "Waiting for 1 player to be ready…"
      : `Waiting for ${notReady} players to be ready…`;
  }
  return null;
}
