import ArgoEngine
import SwiftUI

// What the selected Session's controls actually DO, bound one per intent.
//
// They live beside the shell rather than in it because they are all the same shape — resolve the
// selection, capture its id, hand back a closure — and because each is inert when nothing is
// selected, which is also when there is no control on screen to press. Splitting them off leaves
// `CockpitView` as what it claims to be: navigation, and the projections the zones are handed.

extension CockpitView {
    /// The composer's one intent, bound to the Session the composer addresses — inert when there
    /// is no composer, which is also when there is no field to type into.
    var send: (String) throws -> Void {
        guard let composer else { return { _ in } }
        let sessionID = composer.sessionID
        return { try actions.sendTurn(sessionID, $0) }
    }

    /// What the selected Session's composer is holding, out of the store that outlives the deck.
    /// A Session with no composer gets an inert binding — there is no field to type into, so there
    /// is nothing to keep.
    var draft: Binding<ComposerDraft> {
        guard let composer else { return .constant(ComposerDraft()) }
        return drafts.binding(for: composer.sessionID)
    }

    /// The prompt's one intent, bound the way `send` is — inert when there is no prompt, which is
    /// also when there is nothing to answer.
    var decide: (PermissionDecision) -> Void {
        guard let prompt else { return { _ in } }
        let sessionID = prompt.sessionID
        // The request is captured with the Session, so the answer names the Permission this
        // closure was built over rather than whatever is pending by the time it is called.
        let requestID = prompt.requestID
        return { actions.decidePermission(sessionID, requestID, $0) }
    }

    /// Taking a standing allow back, bound to the selected Session. Off the selection rather than
    /// off the composer, because both vessels draw the tray — the prompt included, and the composer
    /// is absent while it is up.
    var revoke: (String) -> Void {
        guard let session = presentation.session(navigation.session) else { return { _ in } }
        return { actions.revokeStandingAllow(session.id, $0) }
    }

    /// The header's one intent, bound to the Session the header is naming — resolved here for the
    /// same reason the header is: this is the view that knows which Session is selected, and the
    /// issue it serves. It does nothing when nothing is selected, which is also when there is no
    /// button to press.
    /// The fresh Session becomes the selection (story 48). The whole point of handing off is that
    /// the work continues, and a roster left pointing at the Session that just emptied itself into
    /// a brief would make the remedy something you then have to go and find.
    var handOff: () async -> Void {
        guard let session = presentation.session(navigation.session) else { return {} }
        return {
            guard let fresh = await actions.handOffSession(session.id, session.issue?.number)
            else { return }
            navigation.session = fresh
        }
    }

    /// The menu bar's half of the roster's two gestures, addressed at the selected Session — and
    /// `nil` when nothing is selected, which is what greys the items out rather than leaving a
    /// command that would act on nobody.
    ///
    /// Rename opens the row's own field rather than doing anything itself: there is one rename in
    /// this app and it happens in the row, so the menu is a way to REACH it (`SessionCommands`).
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
