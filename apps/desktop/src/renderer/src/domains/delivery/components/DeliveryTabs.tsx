import { cn } from '@/lib/utils'
import {
  Button,
  CaretLeftIcon,
  CheckIcon,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  tabsTriggerVariants,
} from '@/shared/components/ui'

export const DELIVERY_TABS = ['changes', 'review', 'artifacts'] as const

/** Which content the Delivery panel's strip is driving. */
export type DeliveryTab = (typeof DELIVERY_TABS)[number]

export const CHANGES_VIEWS = ['all', 'commits'] as const

/** Which shape the Changes tab renders its files in. */
export type ChangesView = (typeof CHANGES_VIEWS)[number]

function isChangesView(value: string): value is ChangesView {
  return (CHANGES_VIEWS as readonly string[]).includes(value)
}

const REVIEW_TAB_TITLE =
  "agent code review · argo — verdict + findings (the GitHub review lives on the Delivery lifecycle's Review node)"

function isDeliveryTab(value: string): value is DeliveryTab {
  return (DELIVERY_TABS as readonly string[]).includes(value)
}

function ReviewTabLabel({ outstanding }: { outstanding: number }): React.JSX.Element {
  if (outstanding === 0) {
    return (
      <>
        Review <CheckIcon aria-hidden className="text-verdict-approve" />
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
 * Organism: the Delivery panel's tab strip — `Changes · n | Review · n | Artifacts · n`, the
 * same 41px height as the Delivery lifecycle, since the strip IS the panel's header (no separate
 * title row).
 *
 * Three shapes, one component: `unscoped` is the real three-tab tablist (Radix `Tabs`, roving
 * tabindex + `aria-selected` included free); `scoped` is an outcome's return path, a single
 * static label beside a `‹ All changes` back control; `stub` is the two static labels a
 * non-mocked session shows in place of real content. The Review tab's `argo` attribution
 * lives only in its tooltip — never in the visible label — and its outstanding-count badge is
 * the agent review's ONE pointer (R14).
 */
export function DeliveryTabs(
  props:
    | {
        variant: 'unscoped'
        /** Which tab is selected. */
        tab: DeliveryTab
        /** Select a tab. */
        onSelectTab: (tab: DeliveryTab) => void
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
        /** The outcome this Delivery panel is scoped to. */
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
            if (isDeliveryTab(value)) props.onSelectTab(value)
          }}
        >
          <TabsList aria-label="Work" className="min-h-strip px-inset py-tight">
            <TabsTrigger value="changes">Changes · {props.changesCount}</TabsTrigger>
            <TabsTrigger
              value="review"
              tone={props.reviewOutstanding === 0 ? 'neutral' : 'changes'}
              title={REVIEW_TAB_TITLE}
            >
              <ReviewTabLabel outstanding={props.reviewOutstanding} />
            </TabsTrigger>
            <TabsTrigger value="artifacts">Artifacts · {props.artifactsCount}</TabsTrigger>
            {props.tab === 'changes' && (
              <span className="ml-auto">
                <ToggleGroup
                  type="single"
                  value={props.changesView}
                  onValueChange={(value) => {
                    if (isChangesView(value)) props.onChangeChangesView(value)
                  }}
                  aria-label="Changes view"
                >
                  <ToggleGroupItem value="all">All files</ToggleGroupItem>
                  <ToggleGroupItem value="commits">By commit</ToggleGroupItem>
                </ToggleGroup>
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
          <Text
            as="span"
            variant="row"
            className={cn(tabsTriggerVariants(), 'cursor-default')}
            data-state="active"
          >
            {props.outcomeTitle}
          </Text>
        </div>
      )
    case 'stub':
      return (
        <div className="flex min-h-strip items-center gap-hair px-inset py-tight">
          <Text as="span" variant="row" className={tabsTriggerVariants()} data-state="active">
            Changes
          </Text>
          <Text as="span" variant="row" className={tabsTriggerVariants()}>
            Artifacts
          </Text>
        </div>
      )
  }
}
