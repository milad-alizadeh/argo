// The value lives in the person's own Codex config (compaction/auto-compact-config.ts), never in git;
// this module stays free of main-process imports so the renderer control can import the range.
import { z } from 'zod'

// #1904's chosen threshold, consistent across models until Codex sessions carry their own.
export const DEFAULT_AUTO_COMPACT_LIMIT = 180_000

export const AUTO_COMPACT_LIMIT_MIN = 80_000
export const AUTO_COMPACT_LIMIT_MAX = 190_000

export const autoCompactLimitSchema = z
  .number()
  .int()
  .min(AUTO_COMPACT_LIMIT_MIN)
  .max(AUTO_COMPACT_LIMIT_MAX)
