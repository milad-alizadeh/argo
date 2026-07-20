import {
  Button,
  CaretLeftIcon,
  CheckIcon,
  Tabs,
  TabsList,
  TabsTrigger,
  tabsTriggerVariants,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { type ChangesView, ChangesViewToggle } from './ChangesViewToggle'

export const WORK_TABS = ['changes', 'review', 'artifacts'] as const

/** Which content the Work pane's strip is driving. */
export type WorkTab = (typeof WORK_TABS)[number]

const REVIEW_TAB_TITLE =
  "agent code review · argo — verdict + findings (the GitHub review lives on the ribbon's Review node)"

function isWorkTab(value: string): value is WorkTab {
  return (WORK_TABS as readonly string[]).includes(value)
}

function ReviewTabLabel({ outstanding }: { outstanding: number }): React.JSX.Element {
  if (outstanding === 0) {
    return (
      <>
        Review <CheckIcon aria-hidden />
      </>
    )
  }
  return (
    <>
      Review · {outstanding}
      <span
        aria-hidden
        className="ml-tight inline-block size-snug shrink-0 rounded-full bg-verdict-block text-verdict-block glow"
      />
    </>
  )
}

/**
 * Organism: the Work pane's tab strip — `Changes · n | Review · n | Artifacts · n`, the same
 * 41px height as the ship ribbon, since the strip IS the pane's header (no separate title
 * row).
 *
 * Three shapes, one component: `unscoped` is the real three-tab tablist (Radix `Tabs`, roving
 * tabindex + `aria-selected` included free); `scoped` is an outcome's return path, a single
 * static label beside a `‹ All changes` back control; `stub` is the two static labels a
 * non-mocked session shows in place of real content. The Review tab's `argo` attribution
 * lives only in its tooltip — never in the visible label — and its outstanding-count badge is
 * the agent review's ONE pointer (R14).
 */
export function WorkTabs(
  props:
    | {
        variant: 'unscoped'
        /** Which tab is selected. */
        tab: WorkTab
        /** Select a tab. */
        onSelectTab: (tab: WorkTab) => void
        /** Total changed files, for the Changes tab's count. */
        changesCount: number
        /** Open review findings — 0 shows a check instead of a count. */
        reviewOutstanding: number
        /** Every artifact of the session, for the Artifacts tab's count. */
        artifactsCount: number
        /** All files vs By commit — rendered only while the Changes tab is selected. */
        changesView: ChangesView
        /** Select a Changes view. */
        onChangeChangesView: (view: ChangesView) => void
      }
    | {
        variant: 'scoped'
        /** The outcome this Work pane is scoped to. */
        outcomeTitle: string
        /** Return to the unscoped, three-tab strip. */
        onBack: () => void
      }
    | {
        variant: 'stub'
      },
): React.JSX.Element {
  switch (props.variant) {
    case 'unscoped':
      return (
        <Tabs
          value={props.tab}
          onValueChange={(value) => {
            if (isWorkTab(value)) props.onSelectTab(value)
          }}
        >
          <TabsList aria-label="Work" className="min-h-strip px-inset py-tight">
            <TabsTrigger value="changes">Changes · {props.changesCount}</TabsTrigger>
            <TabsTrigger value="review" tone="changes" title={REVIEW_TAB_TITLE}>
              <ReviewTabLabel outstanding={props.reviewOutstanding} />
            </TabsTrigger>
            <TabsTrigger value="artifacts">Artifacts · {props.artifactsCount}</TabsTrigger>
            {props.tab === 'changes' && (
              <span className="ml-auto">
                <ChangesViewToggle
                  view={props.changesView}
                  onChangeView={props.onChangeChangesView}
                />
              </span>
            )}
          </TabsList>
        </Tabs>
      )
    case 'scoped':
      return (
        <div className="flex min-h-strip items-center gap-hair px-inset py-tight">
          <Button variant="quiet" size="sm" onClick={props.onBack}>
            <CaretLeftIcon aria-hidden />
            All changes
          </Button>
          <span className={cn(tabsTriggerVariants(), 'cursor-default')} data-state="active">
            {props.outcomeTitle}
          </span>
        </div>
      )
    case 'stub':
      return (
        <div className="flex min-h-strip items-center gap-hair px-inset py-tight">
          <span className={tabsTriggerVariants()} data-state="active">
            Changes
          </span>
          <span className={tabsTriggerVariants()}>Artifacts</span>
        </div>
      )
  }
}
