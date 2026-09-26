import type { SessionHarness } from './harnesses'
import claudeSpark from './logos/claude-spark.svg?url'
import codexBlack from './logos/codex-black.svg?url'
import codexWhite from './logos/codex-white.svg?url'

// Decorative: the harness's name always sits beside it or in its control's accessible name.
export function HarnessLogo({ harness }: { harness: SessionHarness }) {
  switch (harness) {
    case 'claude':
      return <img aria-hidden="true" alt="" className="size-3.5 shrink-0" src={claudeSpark} />
    case 'codex':
      return (
        <>
          <img
            aria-hidden="true"
            alt=""
            className="size-3.5 shrink-0 dark:hidden"
            src={codexBlack}
          />
          <img
            aria-hidden="true"
            alt=""
            className="hidden size-3.5 shrink-0 dark:block"
            src={codexWhite}
          />
        </>
      )
  }
}
