"use client";

// Turn low-level failures into guidance the user can act on.

export function friendlyTransport(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 4001
  ) {
    return "Request cancelled in your wallet. No transaction was sent.";
  }
  if (error instanceof Error) {
    if (/429|rate limit|too many requests/i.test(error.message)) {
      return "The network rate limit is exhausted. Wait a minute, then press Reload List once.";
    }
    if (/413|too large|entity too large/i.test(error.message)) {
      return "That photo is too large for the network. Use a smaller file (under 1 MB).";
    }
    if (/failed to fetch|networkerror|load failed|timeout|502|504|bad gateway/i.test(error.message)) {
      return "The browser could not reach the network. Check your connection and press Reload List.";
    }
    if (error.message) return error.message;
  }
  return fallback;
}
