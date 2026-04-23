export const REB3LS_HEX = "524542334C53";

export function normalizeSecretCode(value: string) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isReb3lsTrigger(value: string) {
  return normalizeSecretCode(value) === REB3LS_HEX;
}

export function getReb3lsMessage() {
  return {
    title: "REB3LS",
    body:
      `To the first 4 and everyone who came after,\n\n` +
      `Thank you for everything you've done to help me learn and understand this game. ` +
      `Hopefully, this gives back at least a little bit of what you've given me.\n\n` +
      `If you're seeing this, you know who you are.`,
  };
}
