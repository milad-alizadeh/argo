import { createContext } from 'react'
import type { SessionDiagramEvidence, SessionFileEvidence, SessionSkillEvidence } from '../../types'

export type MarkdownEvidenceContextValue = {
  rowId: string
  activeEvidenceId: string | null
  onOpenEvidence: (
    evidence: SessionDiagramEvidence | SessionFileEvidence | SessionSkillEvidence,
  ) => void
  // The prompt's own skill-mention syntax (`[$name](path)`), drawn as a skill badge rather than
  // a file link; off for an assistant's own markdown, which never carries that convention.
  skillMentions?: boolean
}

// Set only when the caller wired evidence handling (an assistant's Feed row); a Ticket's
// description renders the same diagram and file link with no way to open either.
export const MarkdownEvidence = createContext<MarkdownEvidenceContextValue | null>(null)
