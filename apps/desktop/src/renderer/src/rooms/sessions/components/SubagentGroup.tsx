import { cn } from '@/lib/utils'
import { SectionHeader, Text, useDisclosure } from '@/shared/components/ui'
import type { SubagentGroupModel } from '../interiorSubagents'
import { DISCLOSURE, NAV_ROW_SELECTED } from './rowRecipes'
import { SubagentRow } from './SubagentRow'

/**
 * Organism: the Subagents section — one collapsible group over a dense row list.
 *
 * It is a **section of its own** and never interleaved into the Timeline, and it shares the
 * Timeline's header treatment so the two read as two sections of one list. The group name appears
 * only where the CLI reported one: the blueprint degrades from phased (Claude Code) to a labelled
 * tree (Codex) to a flat count, and nothing here fills a tier in.
 *
 * A row here is a SWITCH, not a jump: selecting one replaces the detail pane with that agent's own feed
 * (issue 319), so the rows are these delegates and the highlight is which of them you are reading.
 */
export function SubagentGroup({
  group,
  displayedId,
  onSelect,
}: {
  /** The group's derived view-model — the DISPLAYED agent's delegates. */
  group: SubagentGroupModel
  /** Which agent's feed the detail pane holds, so the row for it reads as the one you are in. */
  displayedId: string
  /** Replace the detail pane with a delegate's feed. */
  onSelect?: (agentId: string) => void
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: true })
  // Collapsed, the header wears the selection for the row it is hiding: the pane can be showing a
  // subagent whose own row is not rendered, and a highlight on nothing visible tracks nothing.
  const holdsActive = !open && group.rows.some((row) => row.agentId === displayedId)
  return (
    <section data-component="SubagentGroup" className="flex flex-col gap-tight">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          DISCLOSURE,
          'flex items-baseline gap-gap rounded-md',
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
              selected={row.agentId === displayedId}
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
