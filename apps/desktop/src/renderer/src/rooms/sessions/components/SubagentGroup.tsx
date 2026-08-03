import { cn } from '@/lib/utils'
import { SectionHeader, Text, useDisclosure } from '@/shared/components/ui'
import type { SubagentGroupModel } from '../interiorSubagents'
import { NAV_ROW_SELECTED } from './rowRecipes'
import { SubagentRow } from './SubagentRow'

/**
 * Organism: the Subagents section — one collapsible group over a dense row list.
 *
 * It is a **section of its own** and never interleaved into the Timeline, and it shares the
 * Timeline's header treatment so the two read as two sections of one list. The group name appears
 * only where the CLI reported one: the blueprint degrades from phased (Claude Code) to a labelled
 * tree (Codex) to a flat count, and nothing here fills a tier in.
 */
export function SubagentGroup({
  group,
  activeKey,
  onSelect,
}: {
  /** The group's derived view-model. */
  group: SubagentGroupModel
  /** Which item the detail feed is showing, tracked by scroll-spy. */
  activeKey: string | null
  /** Jump the detail feed to a subagent's live feed. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: true })
  // Collapsed, the header wears the selection for the row it is hiding: the scroll-spy can name a
  // subagent whose own row is not rendered, and a highlight on nothing visible tracks nothing.
  const holdsActive = !open && group.rows.some((row) => row.key === activeKey)
  return (
    <section data-component="SubagentGroup" className="flex flex-col gap-tight">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'flex cursor-pointer items-baseline gap-gap rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60',
          holdsActive && NAV_ROW_SELECTED,
        )}
      >
        <SectionHeader label="Subagents" count={group.summary} />
      </button>
      {open && (
        <ul aria-label="Subagents" className="flex flex-col">
          {group.rows.map((row) => (
            <SubagentRow
              key={row.key}
              row={row}
              selected={row.key === activeKey}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
      {/* Said for a labelled tree too, not just a bare one: a Codex tree names its subagents but
          reports no phases either, and only the note distinguishes "no phases" from "phases we did
          not draw". What separates the two tiers is the row names, which the rows already carry. */}
      {group.tier !== 'phased' && (
        <Text variant="tag" className="text-foreground-faint">
          this CLI reported no phases
        </Text>
      )}
    </section>
  )
}
