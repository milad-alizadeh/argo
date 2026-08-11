import ArgoEngine
import SwiftUI

// What the selected Session's controls DO. Each resolves the selection, captures its id, and hands
// back a closure that is inert when nothing is selected.

extension CockpitView {
    /// The composer's one intent, bound to the Session the composer addresses.
    var send: ComposerSend {
        guard let composer else { return { _, _ in } }
        let sessionID = composer.sessionID
        return { try actions.drive.send($0, attaching: $1, to: sessionID) }
    }

    /// Stopping the Turn the composer's Session is running (#541), bound the way `send` is — and
    /// inert without a composer, which is also the state with no control to press.
    var stop: () throws -> Void {
        guard let composer else { return {} }
        let sessionID = composer.sessionID
        return { try actions.drive.interrupt(sessionID) }
    }

    /// Putting the composer's Session on a rung (#545), bound the way `stop` is.
    var setMode: (SessionMode) throws -> Void {
        guard let composer else { return { _ in } }
        let sessionID = composer.sessionID
        return { try actions.drive.setMode($0, for: sessionID) }
    }

    /// What the selected Session's composer is holding, out of the store that outlives the deck.
    /// A Session with no composer gets an inert binding.
    var draft: Binding<ComposerDraft> {
        guard let composer else { return .constant(ComposerDraft()) }
        return drafts.binding(for: composer.sessionID)
    }

    /// The prompt's one intent, bound the way `send` is. The refusal is dropped because both of
    /// the port's mean the same thing here — the Permission is gone — and the prompt leaving the
    /// screen already says so.
    var decide: (PermissionDecision) -> Void {
        guard let prompt else { return { _ in } }
        let sessionID = prompt.sessionID
        // The request is captured with the Session, so the answer names the Permission this
        // closure was built over rather than whatever is pending by the time it is called.
        let requestID = prompt.requestID
        return { try? actions.drive.decide($0, answering: requestID, for: sessionID) }
    }

    /// Taking a standing allow back. Off the selection, not the composer: the prompt draws the tray
    /// too, and the composer is absent while it is up. `noSuchGrant` is dropped because the tray is
    /// re-derived from the Session, so the chip goes either way.
    var revoke: (String) -> Void {
        guard let session = presentation.session(navigation.session) else { return { _ in } }
        return { try? actions.drive.revokeStandingAllow($0, for: session.id) }
    }

    /// The header's one intent, bound to the Session the header is naming and the issue it serves.
    /// The fresh Session becomes the selection (story 48).
    var handOff: () async -> Void {
        guard let session = presentation.session(navigation.session) else { return {} }
        return {
            guard let fresh = await actions.handOffSession(session.id, session.issue?.number)
            else { return }
            navigation.session = fresh
        }
    }

    /// Picking a Session Argo can no longer steer resumes it (#10). There is no button and no
    /// prompt: the click is the intent, because the user selected the row in order to use it.
    ///
    /// Only a CHOSEN Session, never the one reconciliation lands on — otherwise launch would start
    /// an agent for the first row on the roster, which is the one thing this must not do. Which
    /// selections cost a process is `SessionResumeProjection`'s.
    func resumeIfSelectionIsDead(_ pick: CockpitNavigationModel.Pick) {
        guard let dead = SessionResumeProjection.resumable(pick.session, in: presentation)
        else { return }
        Task { await actions.resumeSession(dead) }
    }

    /// The exit the undriveable line offers: a fresh Session in the shown one's folder, which then
    /// becomes the selection — story 48's rule, and for its reason. Inert with nothing selected,
    /// which is also the state with no line to press.
    var spawnBeside: () async -> Void {
        guard let session = presentation.session(navigation.session) else { return {} }
        let spawn = CockpitSpawn(
            presentation: presentation,
            actions: actions,
            navigation: navigation,
        )
        return { await spawn.run(beside: session.id) }
    }

    /// The menu bar's half of the roster's two gestures — `nil` when nothing is selected, which is
    /// what greys the items out. Rename only opens the row's own field: there is one rename in this
    /// app and it happens in the row (`SessionCommands`).
    var sessionCommands: SessionCommands? {
        guard let session = presentation.session(navigation.session) else { return nil }
        return SessionCommands(
            rename: { renamingSessionID = session.id },
            archive: { actions.setSessionArchived(session.id, !session.isArchived) },
            renameTitle: SessionRenameProjection.heading,
            archiveTitle: session.isArchived ? "Put Back on the Roster" : "Archive Session",
        )
    }
}
