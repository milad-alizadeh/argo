// A Claude and a Codex Session saved in project-1 and linked to GitHub #273, before the app starts.
import { openDatabase } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'

const LINKED_SESSIONS = [
  { argoId: '00000000-0000-4000-8000-000000000273', harness: 'claude' },
  { argoId: '00000000-0000-4000-8000-000000000274', harness: 'codex' },
] as const

export const LINKED_TICKET_KEY = '#273'

export function seedLinkedSessions(userData: string) {
  const database = openDatabase(userData)
  for (const { argoId, harness } of LINKED_SESSIONS) {
    database
      .insert(sessionTable)
      .values({
        argoId,
        harness,
        nativeId: `native-${harness}`,
        projectId: 'project-1',
        firstPrompt: `A ${harness} first prompt`,
      })
      .run()
    database
      .insert(sessionTicketLink)
      .values({ sessionId: argoId, projectId: 'project-1', ticketKey: LINKED_TICKET_KEY })
      .run()
  }
  database.$client.close()
}
