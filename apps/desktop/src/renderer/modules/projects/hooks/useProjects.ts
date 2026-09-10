// The cockpit's whole picture of the Project surface. Every action answers with the entire known
// set (src/projects/messages.ts), so one settle turns any reply into the next screen and the
// renderer never assembles storage out of a sequence of replies.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type ProjectError,
  type ProjectErrorCode,
  projectError,
} from '../../../../core/projects/contract'
import type { ProjectListReply, ProjectSummary } from '../../../../core/projects/messages'
import { listRequest, openRequest, registerRequest, relocateRequest } from '../lib/requests'

export type CockpitStatus = 'loading' | 'empty' | 'selected' | 'refused'

// A refusal keeps its code as well as its text. The text is what a person reads; the code is what
// the screen is named by, so a capture and a proof cannot report a git failure under the name of a
// folder that holds no repository.
export type Cockpit = {
  status: CockpitStatus
  project: ProjectSummary | null
  message: string | null
  code: ProjectErrorCode | null
  busy: boolean
}

// One action, because what opening a Project means depends on the screen: with a refused Project
// on it, the folder the person picks is that Project's new home rather than a new Project.
export type ProjectActions = { open: () => void }

const IDLE = { project: null, message: null, code: null, busy: false } as const
const LOADING: Cockpit = { status: 'loading', ...IDLE }
const EMPTY: Cockpit = { status: 'empty', ...IDLE }

function refuse(previous: Cockpit, reply: ProjectError): Cockpit {
  const status = previous.status === 'loading' ? 'empty' : previous.status
  return { ...previous, status, message: reply.message, code: reply.code, busy: false }
}

// Opening is what proves the registered folder is still reachable, so it runs on every listing
// rather than only on the first one. A refusal keeps the identity: relocation needs it.
async function settle(reply: ProjectListReply, previous: Cockpit): Promise<Cockpit> {
  if (reply.type === 'project.cancelled') return { ...previous, busy: false }
  if (reply.type === 'project.error') return refuse(previous, reply)
  const project = reply.projects.find((candidate) => candidate.id === reply.selectedId)
  if (!project) return EMPTY
  const opened = await window.argo.openProject(openRequest(project.id))
  if (opened.type === 'project.error') {
    const { message, code } = opened
    return { status: 'refused', project, message, code, busy: false }
  }
  return { status: 'selected', project, message: null, code: null, busy: false }
}

export function useProjects(): [Cockpit, ProjectActions] {
  const [cockpit, setCockpit] = useState<Cockpit>(LOADING)
  const latest = useRef(cockpit)
  useEffect(() => {
    latest.current = cockpit
  })

  // One action at a time, held in a ref rather than in state, because a modal folder chooser must
  // not be opened twice and a state updater is not the place to decide that.
  const running = useRef(false)
  // `finally` is what keeps the guard honest: a throw that left it set would disable every control
  // on the screen for the window's life, with nothing on screen to say why.
  const run = useCallback(async (act: () => Promise<ProjectListReply>) => {
    if (running.current) return
    running.current = true
    // The refusal stays on screen for as long as the action runs. A native folder chooser is open
    // for as long as the person browses, and clearing the message here dropped the refused Project
    // back to the empty deck underneath it for that whole time.
    setCockpit((current) => ({ ...current, busy: true }))
    try {
      setCockpit(await settle(await act(), latest.current))
    } catch {
      setCockpit(refuse(latest.current, projectError('internal-error', null)))
    } finally {
      running.current = false
    }
  }, [])

  useEffect(() => {
    void run(() => window.argo.listProjects(listRequest()))
  }, [run])

  // The menu item, the chord and the deck's own control are one action (apps/desktop/AGENTS.md), so
  // what a refused Project offers on screen is what the chord does.
  const open = useCallback(() => {
    const { status, project } = latest.current
    if (status === 'refused' && project) {
      void run(() => window.argo.relocateProject(relocateRequest(project.id)))
      return
    }
    void run(() => window.argo.registerProject(registerRequest()))
  }, [run])

  return [cockpit, useMemo(() => ({ open }), [open])]
}
