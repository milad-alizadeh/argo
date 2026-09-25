// The Codex auto-compact threshold contract, shared by the bundled main process and renderer.
// The value lives in the person's own `~/.codex/config.toml` (config-file.ts), never in git, so
// it is custom per machine with DEFAULT_AUTO_COMPACT_LIMIT as the sensible starting point.
import { z } from 'zod'

// #1904's chosen threshold: consistent across models until Codex sessions carry their own. Kept
// here, not in config-file.ts, so this module stays free of `node:fs` and safe for the renderer
// to import.
export const DEFAULT_AUTO_COMPACT_LIMIT = 180_000

// Mirrors the range the composer's slider and number input already offer.
export const AUTO_COMPACT_LIMIT_MIN = 80_000
export const AUTO_COMPACT_LIMIT_MAX = 190_000

export const autoCompactLimitSchema = z
  .number()
  .int()
  .min(AUTO_COMPACT_LIMIT_MIN)
  .max(AUTO_COMPACT_LIMIT_MAX)
