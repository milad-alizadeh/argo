// A mock of the Harness's own config file: a write changes it, so a later read (a remount, a
// second control) reads back whatever the popover last wrote, the way the real file would.
const DEFAULT_STORYBOOK_AUTO_COMPACT_LIMIT = 180_000

let limit = DEFAULT_STORYBOOK_AUTO_COMPACT_LIMIT
let unreadable = false
export const writtenAutoCompactLimits: number[] = []

export function resetStorybookAutoCompactLimit(): void {
  limit = DEFAULT_STORYBOOK_AUTO_COMPACT_LIMIT
  unreadable = false
  writtenAutoCompactLimits.length = 0
}

// The config file holds a limit outside the range, so the main process refuses the read.
export function makeStorybookAutoCompactLimitUnreadable(): void {
  resetStorybookAutoCompactLimit()
  unreadable = true
}

export const storybookAutoCompactProcedures = {
  harnessAutoCompactLimitRead: () => {
    if (unreadable) throw new Error('model_auto_compact_token_limit is outside the range.')
    return limit
  },
  harnessAutoCompactLimitWrite: (input: { limit: number }) => {
    limit = input.limit
    writtenAutoCompactLimits.push(input.limit)
    return limit
  },
}
