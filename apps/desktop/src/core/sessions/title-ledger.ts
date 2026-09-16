import type { SessionTitle } from './models'

// The strongest title ever seen for a chain id, kept once the founding file that carried a custom
// or summarised title falls out of the read window (#2290): without it, `readTitle` can only draw
// on the files a poll happened to read, and a title recorded on the origin file alone would
// flicker to the first-prompt fallback every time that file drops out.
const TITLE_RANK: Record<SessionTitle['source'], number> = {
  custom: 2,
  summarised: 1,
  'first-prompt': 0,
}

function strongerTitle(remembered: SessionTitle | null, fresh: SessionTitle | null) {
  if (remembered === null) return fresh
  if (fresh === null) return remembered
  return TITLE_RANK[fresh.source] >= TITLE_RANK[remembered.source] ? fresh : remembered
}

export function createTitleLedger() {
  const remembered = new Map<string, SessionTitle | null>()
  return function strongest(id: string, fresh: SessionTitle | null): SessionTitle | null {
    const title = strongerTitle(remembered.get(id) ?? null, fresh)
    remembered.set(id, title)
    return title
  }
}
