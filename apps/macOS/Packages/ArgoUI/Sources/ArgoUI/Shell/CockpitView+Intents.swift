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
            lostTurnSeen: lostTurnSeen(driven),
            turn: turn(driven),
            settings: settings(for: driven),
            spawnBeside: spawnBeside,
            commands: actions.composer.skills,
            files: files(in: vessel.composer?.workspaceRoot),
            draft: draft(for: driven),
        )
    }

    /// The `@` picker's list, bound to the folder the shown Session works in. Inert where the
    /// records have never said where that is — a tree Argo cannot name is one it must not list.
    private func files(in root: String?) -> () async -> [String] {
        guard let root else { return { [] } }
        return { await actions.composer.workspaceFiles(root) }
    }

    /// The composer's one intent, bound to the Session the composer addresses.
    private func send(to sessionID: String?) -> ComposerSend {
        guard let sessionID else { return { _, _ in } }
        return { try actions.drive.send($0, attaching: $1, to: sessionID) }
    }

    /// The composer has the lost Turn's words back, so the Hub can stop reporting it (#682). Bound
    /// the way `send` is, and inert with nothing selected — which is also the state with no field
    /// to have put anything back into.
    private func lostTurnSeen(_ sessionID: String?) -> () -> Void {
        guard let sessionID else { return {} }
        return { actions.sessions.clearLostTurn(sessionID) }
    }

    /// What can be done to the Turn that Session is running (#541, #1238), bound the way `send`
    /// is and inert together with nothing selected — which is also the state with no Stop to press
    /// and no chip to steer. `steer` is `async` because the port's is: the interrupt and the Turn
    /// are two writes with a pause between them, and the pause belongs beside the keystrokes.
    private func turn(_ sessionID: String?) -> SessionTurnIntents {
        guard let sessionID else { return SessionTurnIntents() }
        return SessionTurnIntents(
            stop: { try actions.drive.interrupt(sessionID) },
            steer: { try await actions.drive.steer($0, attaching: $1, to: sessionID) },
        )
    }

    /// The three standing things the footer can put that Session on (#545, #558), bound the way
    /// `stop` is and inert together with nothing selected — which is also the state with no footer
    /// to press them from. `async` because the port's are: a rung is walked a keystroke at a time
    /// (#653), and the other two reach the CLI as a line typed at its prompt.
    private func settings(for sessionID: String?) -> SessionSettingIntents {
        guard let sessionID else { return SessionSettingIntents() }
        return SessionSettingIntents(
            setMode: { try await actions.drive.setMode($0, for: sessionID) },
            setModel: { try await actions.drive.setModel($0, for: sessionID) },
            setEffort: { try await actions.drive.setEffort($0, for: sessionID) },
        )
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

    /// Answering the question the feed row is drawing (#712), bound the way `decide` is.
    ///
    /// The ask's id comes from the ROW rather than being captured here, because the row is what the
    /// user is looking at: an id resolved at click time would name whatever the gate is holding by
    /// then. The Session is captured, since a row cannot address one. Both refusals are dropped for
    /// the reason `decide`'s are — they mean the question is gone, and the row leaving the screen
    /// already says so.
    func answer(on live: FeedAskProjection.Live?) -> @MainActor (String, AskAnswer) -> Void {
        guard let live else { return { _, _ in } }
        let sessionID = live.sessionID
        return { askID, answer in
            try? actions.drive.answer(answer, answering: askID, for: sessionID)
        }
    }

    /// Taking a standing allow back. Off the selection, not the vessel: the prompt draws the tray
    /// too, and the composer is absent while it is up. `noSuchGrant` is dropped because the tray is
    /// re-derived from the Session, so the chip goes either way.
    var revoke: (String) -> Void {
        guard let session = presentation.session(navigation.session) else { return { _ in } }
        return { try? actions.drive.revokeStandingAllow($0, for: session.id) }
    }

    /// The **Create PR** control's one act (#1335): one `/ship` Turn into the Session the header
    /// is naming, through the same port `answer(on:)` and `revoke` above already use — no queue,
    /// no draft, and no watch on what follows. The Session reports its own status as it runs.
    var createPullRequest: () -> Void {
        guard let session = presentation.session(navigation.session) else { return {} }
        return { try? actions.drive.send("/ship", to: session.id) }
    }

    /// The header's one intent, bound to the Session the header is naming and the issue it serves.
    /// The fresh Session becomes the selection (story 48).
    var handOff: () async -> Void {
        guard let session = presentation.session(navigation.session) else { return {} }
        return {
            let issue = session.ticket.link?.number
            guard let fresh = await actions.sessions.handOff(session.id, issue) else { return }
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
        Task { await actions.sessions.resume(dead) }
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
            for: session,
            rename: { renamingSessionID = $0 },
            archive: { archive(sessionID: $0, isArchived: $1) },
        )
    }

    /// The archive gesture, wherever it is made: the menu bar's item and the roster row's swipe
    /// both come through here, so one prompt covers both (#1290).
    ///
    /// Archiving a Session Argo owns ends its agent, so an archive that would end LIVE work raises
    /// the prompt instead of performing; everything else performs at once. The decision and its
    /// words are `SessionArchiveProjection`'s — this only asks.
    ///
    /// A Session the presentation cannot name is archived without a prompt rather than dropped: it
    /// is a row that exists (the gesture came off one), and a gesture that silently did nothing is
    /// worse than one that skips a question about a Session nothing can describe.
    func archive(sessionID: String, isArchived: Bool) {
        guard let session = presentation.session(sessionID),
              SessionArchiveProjection.confirms(
                  access: session.access,
                  status: session.status,
                  archiving: isArchived,
              )
        else { return actions.sessions.setArchived(sessionID, isArchived) }
        archiveConfirmation = ArchiveConfirmation(id: session.id, name: session.title)
    }
}
