import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ProjectError, ProjectErrorCode } from '../../contract/contract'
import type { SetupDocument } from '../../contract/setup-document'
import { projectListQueryKey } from '../project-queries'

export type SetupMessages = {
  invalid: string
  invalidJson: string
  invalidSetupDocument: string
  setupNetworkUnavailable: string
  saved: string
  valid: string
}

export type ProjectSetupMessage = { tone: 'error' | 'success'; text: string }
export type SetMessage = (message: ProjectSetupMessage | null) => void
export type SetSetup = (setup: { document: SetupDocument; source: string }) => void

export function useSetupActions({
  messages,
  projectId,
  setMessage,
  setSetup,
  source,
}: {
  messages: SetupMessages
  projectId: string
  setMessage: SetMessage
  setSetup: SetSetup
  source: string
}) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState<'apply' | 'test' | null>(null)
  const context = { messages, projectId, setMessage, setSaving, source }
  return {
    applyConfiguration: () =>
      applySetup({
        ...context,
        openProject: () => queryClient.invalidateQueries({ queryKey: projectListQueryKey }),
        setSetup,
      }),
    saving,
    testConfiguration: () => testSetup(context),
  }
}

type ActionContext = {
  messages: SetupMessages
  projectId: string
  setMessage: SetMessage
  setSaving: (action: 'apply' | 'test' | null) => void
  source: string
}

async function testSetup(context: ActionContext) {
  if (!validJson(context)) return
  context.setSaving('test')
  context.setMessage(null)
  const reply = await window.argo.validateProjectSetup({
    projectId: context.projectId,
    source: context.source,
  })
  if (reply.type === 'project.setup.validated') {
    context.setMessage({
      tone: reply.valid ? 'success' : 'error',
      text: reply.valid ? context.messages.valid : context.messages.invalid,
    })
  } else if (reply.type === 'project.error') {
    context.setMessage({ tone: 'error', text: setupErrorMessage(reply, context.messages) })
  }
  context.setSaving(null)
}

async function applySetup(
  context: ActionContext & { openProject: () => Promise<unknown>; setSetup: SetSetup },
) {
  if (!validJson(context)) return
  context.setSaving('apply')
  context.setMessage(null)
  const saved = await window.argo.saveProjectSetup({
    projectId: context.projectId,
    source: context.source,
  })
  if (saved.type !== 'project.setup.editing') {
    setReplyError(context, saved)
    return
  }
  context.setSetup(saved)
  context.setMessage({ tone: 'success', text: context.messages.saved })
  await context.openProject()
  context.setSaving(null)
}

function setReplyError(
  context: ActionContext,
  reply: Awaited<ReturnType<typeof window.argo.saveProjectSetup>>,
) {
  const text =
    reply.type === 'project.error'
      ? setupErrorMessage(reply, context.messages)
      : context.messages.invalid
  context.setMessage({ tone: 'error', text })
  context.setSaving(null)
}

function validJson(context: Pick<ActionContext, 'messages' | 'setMessage' | 'source'>) {
  try {
    JSON.parse(context.source)
    return true
  } catch {
    context.setMessage({ tone: 'error', text: context.messages.invalidJson })
    return false
  }
}

const SETUP_ERROR_MESSAGES = {
  'setup-network-unavailable': 'setupNetworkUnavailable',
  'setup-document-invalid': 'invalidSetupDocument',
} as const satisfies Partial<Record<ProjectErrorCode, keyof SetupMessages>>

export function setupErrorMessage(error: ProjectError, messages: SetupMessages) {
  const key = SETUP_ERROR_MESSAGES[error.code as keyof typeof SETUP_ERROR_MESSAGES]
  return key ? messages[key] : error.message
}
