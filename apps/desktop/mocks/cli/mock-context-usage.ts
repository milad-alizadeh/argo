// The context usage each mock CLI reports when a Turn ends; the e2e case reads it back from the bar.
export const MOCK_CONTEXT_USAGE = {
  claude: { usedTokens: 46_000, windowTokens: 200_000 },
  codex: { usedTokens: 64_000, windowTokens: 256_000 },
} as const
