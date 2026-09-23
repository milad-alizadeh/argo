import { useEffect, useMemo, useRef, useState } from 'react'
import type { Cockpit, ProjectActions } from '@/domains/projects/renderer'
import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { HARNESSES, type SessionHarness } from '../../harness/harnesses'
import { useSessionCreationStore } from '../../session-creation'
import type { useSessions } from '../../use-sessions'
import { composerIdentityOf, findSessionRow } from '../identity/composer-identity'
import type { Failure } from '../send/session-failure'
import type { WorkspaceMenuControlProps } from '../toolbar/workspace-menu'
import { codexTurnSetup } from '../turn-setup/codex-turn-setup'
import { useTurnSetup } from '../turn-setup/use-turn-setup'
import { useTurnMarker } from './use-turn-marker'

const NO_ROWS: SessionRosterRow[] = []

function useCodexCatalog(harness: SessionHarness) {
  const [catalog, setCatalog] = useState<CodexModelCatalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [catalogRequest, setCatalogRequest] = useState(0)
  const catalogRequestRef = useRef(catalogRequest)
  catalogRequestRef.current = catalogRequest
  useEffect(() => {
    if (harness !== 'codex') {
      setCatalog(null)
      setCatalogError(false)
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const request = catalogRequest
    const readCatalog = async () => {
      const result = await window.argo.readCodexModelCatalog().catch(() => null)
      if (!active || request !== catalogRequestRef.current) return
      const usableCatalog = result?.data.some(({ hidden }) => !hidden) ? result : null
      setCatalog(usableCatalog)
      setCatalogError(usableCatalog === null)
      if (usableCatalog !== null) timer = setTimeout(readCatalog, 30_000)
    }
    void readCatalog()
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [catalogRequest, harness])
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
  const { catalog, catalogError, refreshCatalog } = useCodexCatalog(harness)
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
    () => (harness === 'codex' ? codexTurnSetup(catalog) : HARNESSES[harness].setup),
    [catalog, harness],
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
    catalogError,
    catalog,
    refreshCatalog,
    marker,
    selectedRow,
    isCompacting: (selectedRow?.compactionStartedAt ?? null) !== null,
  }
}
