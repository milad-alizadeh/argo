import type { SessionFeedReaderContext } from '../feed/feed-reader'
import { SessionFeedReaders } from '../feed/feed-reader'
import { composerDraftCreateProcedure } from './composer-draft-create'
import { composerDraftReadProcedure } from './composer-draft-read'
import { composerDraftSaveProcedure } from './composer-draft-save'
import { sessionArchiveProcedures } from './session-archive'
import { type SessionAttachmentContext, sessionAttachmentProcedures } from './session-attachments'
import {
  type ComposerCommandContext,
  composerCommandsProcedure,
  sessionComposerCommandsProcedure,
} from './session-composer-commands'
import { sessionDetailsProcedure } from './session-details'
import { sessionFeedProcedures } from './session-feed'
import { sessionFileReadProcedures } from './session-file-reads'
import {
  type SessionInteractionContext,
  sessionInteractionProcedures,
} from './session-interactions'
import { type SessionListContext, sessionListProcedure } from './session-list'
import { type SessionRefreshContext, sessionRefreshProcedure } from './session-refresh'
import { sessionRenameProcedure } from './session-rename'
import { type SessionProcedureContext, sessionSubmitProcedure } from './session-submit'
import { type SessionSyncStatusStore, sessionSyncStatusProcedure } from './session-sync-status'
import { sessionWorkReadProcedures } from './session-work-reads'

export type SessionApiContext = SessionProcedureContext &
  SessionAttachmentContext &
  SessionFeedReaderContext &
  SessionInteractionContext &
  SessionListContext &
  SessionRefreshContext &
  ComposerCommandContext & { sessionSyncStatus: readonly SessionSyncStatusStore[] }

export function sessionProcedures(context: SessionApiContext) {
  const readers = new SessionFeedReaders(context)
  return {
    composerCommands: composerCommandsProcedure(context),
    sessionComposerCommands: sessionComposerCommandsProcedure(context),
    composerDraftCreate: composerDraftCreateProcedure(context.database),
    composerDraftRead: composerDraftReadProcedure(context.database),
    composerDraftSave: composerDraftSaveProcedure(context.database),
    sessionSubmit: sessionSubmitProcedure(context),
    sessionList: sessionListProcedure(context, (sessionId) =>
      readers.observe({ sessionId, subagentId: null }, () => {}),
    ),
    sessionDetails: sessionDetailsProcedure(context),
    ...sessionFeedProcedures(context, readers),
    ...sessionInteractionProcedures(context),
    sessionRename: sessionRenameProcedure(context),
    sessionRefresh: sessionRefreshProcedure(context),
    sessionSyncStatus: sessionSyncStatusProcedure(context.sessionSyncStatus),
    ...sessionAttachmentProcedures(context),
    ...sessionFileReadProcedures(context),
    ...sessionArchiveProcedures(context),
    ...sessionWorkReadProcedures(),
  }
}
