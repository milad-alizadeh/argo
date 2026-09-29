import { type SessionFeedReaderContext, SessionFeedReaders } from '../feed/feed-reader'
import {
  type ComposerCommandContext,
  composerCommandsProcedure,
  sessionComposerCommandsProcedure,
} from './composer-commands'
import { composerDraftCreateProcedure } from './composer-draft-create'
import { composerDraftReadProcedure } from './composer-draft-read'
import { composerDraftSaveProcedure } from './composer-draft-save'
import { sessionFeedProcedures } from './session-feed'
import {
  type SessionInteractionContext,
  sessionInteractionProcedures,
} from './session-interactions'
import { type SessionListContext, sessionListProcedure } from './session-list'
import { type SessionRefreshContext, sessionRefreshProcedure } from './session-refresh'
import { sessionRenameProcedure } from './session-rename'
import { type SessionProcedureContext, sessionSubmitProcedure } from './session-submit'
import { type SessionSyncStatusStore, sessionSyncStatusProcedure } from './session-sync-status'

export type SessionApiContext = SessionProcedureContext &
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
    ...sessionFeedProcedures(context, readers),
    ...sessionInteractionProcedures(context),
    sessionRename: sessionRenameProcedure(context),
    sessionRefresh: sessionRefreshProcedure(context),
    sessionSyncStatus: sessionSyncStatusProcedure(context.sessionSyncStatus),
  }
}
