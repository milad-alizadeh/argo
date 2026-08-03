import { TabsList, TabsTrigger, Text } from '@/shared/components/ui'
import { INTERIOR_TABS, type InteriorTab } from '../interiorModel'

const TAB_LABELS: Record<InteriorTab, string> = {
  activity: 'Activity',
  delivery: 'Delivery',
}

/**
 * Molecule: the session's two tabs — `Activity · Delivery`, and exactly those two.
 *
 * They live INSIDE the header band, bottom-aligned to its edge, so they read as attached to the
 * content below rather than as a strip of their own. Outcomes was cut and Preview was never a tab,
 * which is why the set is a constant rather than a prop.
 */
export function SessionTabs({ className }: { className?: string }): React.JSX.Element {
  return (
    <TabsList aria-label="Session panels" className={className}>
      {INTERIOR_TABS.map((tab) => (
        <TabsTrigger key={tab} value={tab}>
          <Text variant="row">{TAB_LABELS[tab]}</Text>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
