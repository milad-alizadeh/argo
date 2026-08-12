import ArgoEngine
import SwiftUI

// What the selected Session's controls DO. Each resolves the selection, captures its id, and hands
// back a closure that is inert when nothing is selected.

extension CockpitView {
    /// Everything the deck's vessel can do, bound to the Session it addresses.
    ///
    /// Takes the vessel rather than reading `CockpitView.vessel` back: that property resolves the
    /// selection and up to three projections on every read, and this needs the answer five times.
    func intents(for vessel: DeckVessel) -> DeckIntents {
        // The Session the FIELD addresses, resolved once. A prompt in the slot means there is no
        // composer, which is also the state with no field, no Stop and no rung to press.
        let driven = vessel.composer?.sessionID
        return DeckIntents(
            send: send(to: driven),
            decide: decide(answering: vessel.prompt),
            revoke: revoke,
            stop: stop(driven),
            setMode: setMode(driven),
            spawnBeside: spawnBeside,
            draft: draft(for: driven),
        )
    }

    /// The composer's one intent, bound to the Session the composer addresses.
    private func send(to sessionID: String?) -> ComposerSend {
        guard let sessionID else { return { _, _ in } }
        return { try actions.drive.send($0, attaching: $1, to: sessionID) }
    }

    /// Stopping the Turn that Session is running (#541), bound the way `send` is.
    private func stop(_ sessionID: String?) -> () throws -> Void {
        guard let sessionID else { return {} }
        return { try actions.drive.interrupt(sessionID) }
    }

    /// Putting that Session on a rung (#545), bound the way `stop` is — and `async` because the
    /// port's walk is: the ring is stepped one keystroke at a time (#653).
    private func setMode(_ sessionID: String?) -> (SessionMode) async throws -> Void {
        guard let sessionID else { return { _ in } }
        return { try await actions.drive.setMode($0, for: sessionID) }
    }

    /// What the composer is holding, out of the store that outlives the deck.
    private func draft(for sessionID: String?) -> Binding<ComposerDraft> {
        guard let sessionID else { return .constant(ComposerDraft()) }
        return drafts.binding(for: sessionID)
    }

    /// The prompt's one intent, bound the way `send` is. The refusal is dropped because both of
    /// the port's mean the same thing here — the Permission is gone — and the prompt leaving the
    /// screen already says so.
    private func decide(
        answering prompt: PermissionPromptProjection.Prompt?,
    )
        -> (PermissionDecision) -> Void {
        guard let prompt else { return { _ in } }
        let sessionID = prompt.sessionID
        // The request is captured with the Session, so the answer names the Permission this
        // closure was built over rather than whatever is pending by the time it is called.
        let requestID = prompt.requestID
        return { try? actions.drive.decide($0, answering: requestID, for: sessionID) }
    }

    /// Taking a standing allow back. Off the selection, not the vessel: the prompt draws the tray
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
