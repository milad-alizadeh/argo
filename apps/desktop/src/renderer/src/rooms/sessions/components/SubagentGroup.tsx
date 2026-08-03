import { SectionHeader, Text, useDisclosure } from '@/shared/components/ui'
import type { SubagentGroupModel } from '../interiorSubagents'
import { SubagentRow } from './SubagentRow'

// What the section header says beside `Subagents`, per blueprint tier. A flat tier reports a count
// and nothing more, because that is all a bare CLI told us — the cockpit never invents a phase.
function summary({ tier, group, rows, runningCount }: SubagentGroupModel): string {
  const running = `${runningCount} running`
  return tier === 'phased' && group !== null
    ? `${group} · ${running}`
    : `${rows.length} · ${running}`
}

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
  return (
    <section data-component="SubagentGroup" className="flex flex-col gap-tight">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex cursor-pointer items-baseline gap-gap text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
      >
        <SectionHeader label="Subagents" count={summary(group)} />
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
      {group.tier === 'flat' && (
        <Text variant="tag" className="text-foreground-faint">
          this CLI reported no phases
        </Text>
      )}
    </section>
  )
}
