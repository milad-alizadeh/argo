import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, Text, useDisclosure } from '@/shared/components/ui'
import { DISCLOSURE } from '../components/rowRecipes'
import { SubagentRow } from '../components/SubagentRow'
import type { Chapter } from './feedIndex'

// PROTOTYPE. The fanout WHERE IT HAPPENED, folded to one line — the shared answer to "the Subagents
// group holds permanent space". A delegate is spawned by one turn, so its home is that turn's
// section, and it costs one line until you want it.

/** The one line a fanout costs when nobody is looking at it. */
function foldLine(delegates: Chapter['delegates']): string {
  const groups = new Set(delegates.map((item) => item.group).filter((group) => group !== null))
  const phase = groups.size === 1 ? ` · ${[...groups][0]}` : ''
  return `${delegates.length} subagents${phase}`
}

/**
 * The delegates a turn spawned, on their own spine, behind one fold.
 *
 * Closed by default: a fanout is something you consult when its parent's answer surprises you, which
 * is the same reason a thought row is closed. Open, it is the shipped dense row list verbatim — the
 * question here is where the list LIVES, not how a row of it reads.
 */
export function InlineDelegates({
  delegates,
}: {
  delegates: Chapter['delegates']
}): React.JSX.Element | null {
  const [open, toggle] = useDisclosure({ defaultOpen: false })
  if (delegates.length === 0) return null
  const Caret = open ? CaretDownIcon : CaretRightIcon
  return (
    <div className="flex flex-col gap-tight border-l border-l-inset-hair pl-inset">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(DISCLOSURE, 'flex w-full items-baseline gap-snug')}
      >
        <Text aria-hidden variant="prose" className="shrink-0 text-primary">
          <Caret className="icon-sm" />
        </Text>
        <Text variant="prose" className="min-w-0 flex-1 truncate text-primary">
          {foldLine(delegates)}
        </Text>
      </button>
      {open && (
        <ul aria-label="Subagents" className="flex flex-col">
          {delegates.map((item) => (
            <SubagentRow key={item.key} row={item.subagent} selected={false} />
          ))}
        </ul>
      )}
    </div>
  )
}
