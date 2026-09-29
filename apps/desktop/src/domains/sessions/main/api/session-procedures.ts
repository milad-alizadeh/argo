import { composerDraftCreateProcedure } from './composer-draft-create'
import { composerDraftReadProcedure } from './composer-draft-read'
import { composerDraftSaveProcedure } from './composer-draft-save'
import { sessionFeedProcedures } from './session-feed'
import { type SessionFeedReadContext, sessionFeedReadProcedure } from './session-feed-read'
import {
  type SessionInteractionContext,
  sessionInteractionProcedures,
} from './session-interactions'
import { type SessionListContext, sessionListProcedure } from './session-list'
import { type SessionLiveEventsContext, sessionLiveEventsProcedure } from './session-live-events'
import { type SessionRefreshContext, sessionRefreshProcedure } from './session-refresh'
import { sessionRenameProcedure } from './session-rename'
import { type SessionProcedureContext, sessionSubmitProcedure } from './session-submit'
import { type SessionSyncStatusStore, sessionSyncStatusProcedure } from './session-sync-status'

export type SessionApiContext = SessionProcedureContext &
  SessionFeedReadContext &
  SessionInteractionContext &
  SessionListContext &
  SessionLiveEventsContext &
  SessionRefreshContext & { sessionSyncStatus: readonly SessionSyncStatusStore[] }

export function sessionProcedures(context: SessionApiContext) {
  return {
    composerDraftCreate: composerDraftCreateProcedure(context.database),
    composerDraftRead: composerDraftReadProcedure(context.database),
    composerDraftSave: composerDraftSaveProcedure(context.database),
    sessionSubmit: sessionSubmitProcedure(context),
    sessionList: sessionListProcedure(context),
    sessionFeedRead: sessionFeedReadProcedure(context),
    ...sessionFeedProcedures(context),
    ...sessionInteractionProcedures(context),
    sessionLiveEvents: sessionLiveEventsProcedure(context),
    sessionRename: sessionRenameProcedure(context),
    sessionRefresh: sessionRefreshProcedure(context),
    sessionSyncStatus: sessionSyncStatusProcedure(context.sessionSyncStatus),
  }
}
