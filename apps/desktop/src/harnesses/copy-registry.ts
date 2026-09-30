import claude from './claude/locales/en.json'
import claudeAcp from './claude-acp/locales/en.json'
import codex from './codex/locales/en.json'
import type { Harness } from './harness'

// The renderer's `harnesses` namespace: each Harness's names, from its own catalog.
export const HARNESS_CATALOG = {
  claude: claude.presentation,
  codex: codex.presentation,
  'claude-acp': claudeAcp.presentation,
} satisfies Record<Harness, { shortLabel: string; label: string }>
