import { createContext } from 'react'
import type { SessionDiagramEvidence, SessionFileEvidence } from '@/domains/sessions/renderer/types'

export type MarkdownEvidenceContextValue = {
  rowId: string
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionDiagramEvidence | SessionFileEvidence) => void
}

// Set only when the caller wired evidence handling (an assistant's Feed row); a Ticket's
// description renders the same diagram and file link with no way to open either.
export const MarkdownEvidence = createContext<MarkdownEvidenceContextValue | null>(null)
