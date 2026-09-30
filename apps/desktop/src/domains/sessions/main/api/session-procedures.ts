import type { SessionFeedReaders } from '../feed/feed-reader'
import { composerDraftCreateProcedure } from './composer-draft-create'
import { composerDraftReadProcedure } from './composer-draft-read'
import { composerDraftSaveProcedure } from './composer-draft-save'
import { type SessionAttachmentContext, sessionAttachmentProcedures } from './session-attachments'
import {
  type ComposerCommandContext,
  composerCommandsProcedure,
  sessionComposerCommandsProcedure,
} from './session-composer-commands'
import { sessionFeedProcedures } from './session-feed'
import { sessionFileReadProcedures } from './session-file-reads'
import {
  type SessionInteractionContext,
  sessionInteractionProcedures,
} from './session-interactions'
import {
  type SessionListContext,
  sessionDetailsProcedure,
  sessionListChangedProcedure,
  sessionListProcedure,
} from './session-list'
import { type SessionRefreshContext, sessionRefreshProcedure } from './session-refresh'
import { type SessionProcedureContext, sessionSubmitProcedure } from './session-submit'
import { type SessionSyncStatusSource, sessionSyncStatusProcedure } from './session-sync-status'
import { type SessionUpdateProcedureContext, sessionUpdateProcedure } from './session-update'
import { sessionWorkReadProcedures } from './session-work-reads'

export type SessionApiContext = SessionProcedureContext &
  SessionAttachmentContext &
  SessionInteractionContext &
  SessionListContext &
  SessionRefreshContext &
  SessionUpdateProcedureContext &
  ComposerCommandContext & {
    sessionSync: SessionSyncStatusSource
    // Shared with the app-level watcher that keeps working Sessions' Feeds open.
    readers: SessionFeedReaders
  }

export function sessionProcedures(context: SessionApiContext) {
  return {
    composerCommands: composerCommandsProcedure(context),
    sessionComposerCommands: sessionComposerCommandsProcedure(context),
    composerDraftCreate: composerDraftCreateProcedure(context.database),
    composerDraftRead: composerDraftReadProcedure(context.database),
    composerDraftSave: composerDraftSaveProcedure(context.database),
    sessionSubmit: sessionSubmitProcedure(context),
    sessionList: sessionListProcedure(context),
    sessionListChanged: sessionListChangedProcedure(context),
    sessionDetails: sessionDetailsProcedure(context),
    ...sessionFeedProcedures(context.readers),
    ...sessionInteractionProcedures(context),
    sessionUpdate: sessionUpdateProcedure(context),
    sessionRefresh: sessionRefreshProcedure(context),
    sessionSyncStatus: sessionSyncStatusProcedure(context.sessionSync),
    ...sessionAttachmentProcedures(context),
    ...sessionFileReadProcedures(context),
    ...sessionWorkReadProcedures(),
  }
}
