import type { LifecycleModel, LifecycleNodeKey } from '@shared'
import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'
import { AllFilesDiff, type AllFilesDiffFile } from './AllFilesDiff'
import { CommitGroup, type CommitGroupFile } from './CommitGroup'
import { DeliveryLifecycle } from './DeliveryLifecycle'
import { type ChangesView, type DeliveryTab, DeliveryTabs } from './DeliveryTabs'
import { NodeDrawer, type NodeDrawerSession } from './NodeDrawer'

/** One commit's files as the By-commit view renders them — `commit: null` is the WIP group. */
export interface DeliveryCommitGroup {
  commit: { sha: string; message: string } | null
  files: CommitGroupFile[]
}

const CONTENT_LABEL: Record<DeliveryTab, string> = {
  changes: 'Changes',
  review: 'Review',
  artifacts: 'Artifacts',
}

export interface DeliveryProps {
  /** The lifecycle's pre-derived render state (`shared/lifecycleModel.ts`) — `null` shows no
   * strip and no drawer (R7). The one model both the strip and the open drawer read. */
  lifecycle: LifecycleModel | null
  /** Which node's drawer is open, or `null` for none. Read against `lifecycle` — no
   * re-derivation — for the drawer's `state`/`isHead`. Ignored while terminal (R8: the
   * terminal summary replaces the per-node drawer). */
  openNode: LifecycleNodeKey | null
  /** The PR this session ships through, once one exists — `null` before `Create PR` runs. */
  pr: { num: number; ghUrl: string } | null
  /** Everything the open node's drawer body can draw on (`NodeDrawer` reads only its slice). */
  drawerSession: NodeDrawerSession
  /** Which content tab is selected. */
  tab: DeliveryTab
  /** All files vs By commit — only the Changes tab reads it. */
  changesView: ChangesView
  /** Open review findings — 0 shows a check on the tab instead of a count. */
  reviewOutstanding: number
  /** Every artifact of the session, for the Artifacts tab's count. */
  artifactsCount: number
  /** Every changed file, flat — also the Changes tab's count. */
  allFiles: AllFilesDiffFile[]
  /** The same changes grouped per commit, for the By-commit view. */
  commitGroups: DeliveryCommitGroup[]
  /** Select a content tab. */
  onSelectTab: (tab: DeliveryTab) => void
  /** Select a Changes view. */
  onChangeChangesView: (view: ChangesView) => void
  /** Advance a finding on one of the changed files. */
  onAdvanceFindingState: (id: string) => void
  className?: string
}

/**
 * Organism: the Delivery panel body — lifecycle strip, the selected node's drawer, the tab
 * strip, and the selected tab's content, top to bottom. Pure presentation over a pre-derived
 * view-model (SessionScreen owns the panel chrome and the derivation); it composes, never
 * re-derives.
 */
export function Delivery({
  lifecycle,
  openNode,
  pr,
  drawerSession,
  tab,
  changesView,
  reviewOutstanding,
  artifactsCount,
  allFiles,
  commitGroups,
  onSelectTab,
  onChangeChangesView,
  onAdvanceFindingState,
  className,
}: DeliveryProps): React.JSX.Element {
  const drawer = (() => {
    if (!lifecycle) return null
    if (lifecycle.terminal) {
      return <NodeDrawer node="terminal" state={lifecycle.terminal} session={drawerSession} />
    }
    if (openNode === null) return null
    return (
      <NodeDrawer
        node={openNode}
        state={lifecycle.nodes[openNode]}
        isHead={openNode === lifecycle.head}
        session={drawerSession}
      />
    )
  })()

  const content = (() => {
    switch (tab) {
      case 'changes':
        return changesView === 'all' ? (
          <AllFilesDiff files={allFiles} onAdvanceFindingState={onAdvanceFindingState} />
        ) : (
          commitGroups.map((group) => (
            <CommitGroup
              key={group.commit?.sha ?? 'uncommitted'}
              commit={group.commit}
              files={group.files}
              onAdvanceFindingState={onAdvanceFindingState}
            />
          ))
        )
      // R14's verdict hero + findings list land with the SessionScreen — until then the tab is
      // an honest empty state rather than a broken promise.
      case 'review':
        return (
          <Text variant="meta" className="text-muted-foreground">
            Review lands with the session screen.
          </Text>
        )
      case 'artifacts':
        return (
          <Text variant="meta" className="text-muted-foreground">
            Artifacts land with the session screen.
          </Text>
        )
    }
  })()

  return (
    <section
      aria-label="Delivery"
      data-slot="delivery"
      className={cn('flex min-h-0 flex-col', className)}
    >
      <DeliveryLifecycle model={lifecycle} openKey={openNode} pr={pr} />
      {drawer}
      <DeliveryTabs
        variant="unscoped"
        tab={tab}
        onSelectTab={onSelectTab}
        changesCount={allFiles.length}
        reviewOutstanding={reviewOutstanding}
        artifactsCount={artifactsCount}
        changesView={changesView}
        onChangeChangesView={onChangeChangesView}
      />
      <section aria-label={CONTENT_LABEL[tab]} className="min-h-0 flex-1 overflow-y-auto p-inset">
        {content}
      </section>
    </section>
  )
}
