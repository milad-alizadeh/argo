import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cockpit, ProjectActions } from '@/domains/projects/renderer'
import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'
import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionHarness } from '../../harness/harnesses'
import { useSessionCreationStore } from '../../session-creation'
import type { useSessions } from '../../use-sessions'
import { composerIdentityOf, findSessionRow } from '../identity/composer-identity'
import type { Failure } from '../send/session-failure'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { claudeTurnSetup } from '../turn-setup/claude-turn-setup'
import { codexTurnSetup } from '../turn-setup/codex-turn-setup'
import { useTurnSetup } from '../turn-setup/use-turn-setup'
import { useTurnMarker } from './use-turn-marker'

const NO_ROWS: SessionRosterRow[] = []

function useModelCatalog<Catalog>(options: {
  harness: SessionHarness
  targetHarness: SessionHarness
  readCatalog: () => Promise<Catalog | null>
  isUsable?: (catalog: Catalog) => boolean
}) {
  const { harness, targetHarness, readCatalog, isUsable = () => true } = options
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [catalogRequest, setCatalogRequest] = useState(0)
  const catalogRequestRef = useRef(catalogRequest)
  const readCatalogRef = useRef(readCatalog)
  const isUsableRef = useRef(isUsable)
  catalogRequestRef.current = catalogRequest
  readCatalogRef.current = readCatalog
  isUsableRef.current = isUsable
  useEffect(() => {
    if (harness !== targetHarness) {
      setCatalog(null)
      setCatalogError(false)
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const request = catalogRequest
    const readOnce = async () => {
      const result = await readCatalogRef.current().catch(() => null)
      if (!active || request !== catalogRequestRef.current) return
      const usableCatalog = result !== null && isUsableRef.current(result) ? result : null
      setCatalog(usableCatalog)
      setCatalogError(usableCatalog === null)
      if (usableCatalog !== null) timer = setTimeout(readOnce, 30_000)
    }
    void readOnce()
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [catalogRequest, harness, targetHarness])
  return {
    catalog,
    catalogError,
    refreshCatalog: () => setCatalogRequest((current) => current + 1),
  }
}

export type ComposerFactsOptions = {
  harness: SessionHarness
  cockpit: Cockpit
  projectActions: Pick<ProjectActions, 'selectWorkspace' | 'createManagedWorkspace'>
  roster: ReturnType<typeof useSessions>['roster']
  selectedSessionId: string | null
}

// A Session's Workspace is fixed at `session.start` (AC6, #2600): the picker is only offered
// before a Roster row exists for it.
function workspaceControl(
  identity: ReturnType<typeof composerIdentityOf>,
  cockpit: Cockpit,
  projectActions: ComposerFactsOptions['projectActions'],
): WorkspaceMenuControlProps | null {
  if (identity.kind !== 'draft') return null
  return {
    workspaces: cockpit.workspaces,
    workspace: cockpit.workspace,
    onSelect: projectActions.selectWorkspace,
    onCreateManaged: () => projectActions.createManagedWorkspace('HEAD'),
  }
}

// The facts the setup pane, the mutations, and the Turn Marker all need before they can be wired:
// who is selected, and the harness setup control that goes with them.
export function useComposerFacts(
  options: ComposerFactsOptions,
  setFailure: (failure: Failure | null) => void,
) {
  const { harness, cockpit, projectActions, roster, selectedSessionId } = options
  const codex = useModelCatalog<CodexModelCatalog>({
    harness,
    targetHarness: 'codex',
    readCatalog: () => window.argo.readCodexModelCatalog(),
    isUsable: (value) => value.data.some(({ hidden }) => !hidden),
  })
  const claude = useModelCatalog<ClaudeModelCatalog>({
    harness,
    targetHarness: 'claude',
    readCatalog: () => window.argo.readClaudeModelCatalog(),
  })
  // The "+" click already gave this row a pending identity (#2109); a bare selection has none.
  const pending = useSessionCreationStore((state) => state.pending)
  const pendingSessionId = pending?.stage === 'draft' ? pending.id : null
  const identity = composerIdentityOf(
    selectedSessionId,
    cockpit.project?.id ?? null,
    pendingSessionId,
  )
  const sessionId = identity.kind === 'session' ? identity.sessionId : null
  const choices = useMemo(
    () => (harness === 'codex' ? codexTurnSetup(codex.catalog) : claudeTurnSetup(claude.catalog)),
    [codex.catalog, claude.catalog, harness],
  )
  const { control, watchTurn } = useTurnSetup({
    harness,
    choices,
    identity,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: (refusal) => setFailure({ ...refusal, code: null }),
  })
  const marker = useTurnMarker()
  const selectedRow = findSessionRow(roster, sessionId)
  return {
    identity,
    sessionId,
    control,
    workspace: workspaceControl(identity, cockpit, projectActions),
    watchTurn,
    catalogError: codex.catalogError,
    claudeCatalogError: claude.catalogError,
    catalog: codex.catalog,
    refreshCatalog: codex.refreshCatalog,
    refreshClaudeCatalog: claude.refreshCatalog,
    marker,
    selectedRow,
    isCompacting: (selectedRow?.compactionStartedAt ?? null) !== null,
  }
}
