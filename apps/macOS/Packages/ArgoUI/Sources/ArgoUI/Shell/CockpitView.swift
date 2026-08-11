import ArgoEngine
import SwiftUI

/// The production application shell: native navigation, one opaque deck, and two glass vessels.
///
/// The one place in the shell that reads the navigation model. Everything below it takes values
/// and bindings, so each piece still renders from a `#Preview` or a specimen without one.
public struct CockpitView: View {
    private let presentation: CockpitPresentation
    private let actions: CockpitActions
    @Environment(CockpitNavigationModel.self) private var navigation
    /// Which roster row has its name field open. Held here rather than in the sidebar because the
    /// menu bar reaches it (`sessionCommands` below), and the menu bar is outside the sidebar.
    @State private var renamingSessionID: String?

    public init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
    ) {
        self.presentation = presentation
        self.actions = actions
    }

    /// The selected Session's reading, projected here because this is the one view that knows what
    /// is selected. Recomputed on every update rather than cached: the presentation is a value the
    /// Hub rebuilds as the transcript grows, so a feed that memoised would be showing the reading
    /// as it was when the user last clicked.
    private var feed: [FeedRow] {
        FeedProjection.rows(from: events, handedOff: presentation.handoff(of: navigation.session))
    }

    /// The same Session's plan, off the same stream. Read separately rather than pulled out of the
    /// rows, because it is not one: the plan is the standing state a whole transcript resolves to,
    /// and the feed is the sequence of moments that produced it.
    private var showing: PlanShowing {
        PlanShowing(plan: PlanProjection.reading(from: events))
    }

    /// What the deck's top zone names, projected here for the reason the feed is: this is the one
    /// view that knows which Session is selected, and a zone that looked one up would be a layout
    /// choosing its own subject.
    private var header: SessionHeaderProjection.Header? {
        presentation.session(navigation.session).map(SessionHeaderProjection.header(from:))
    }

    private var events: [TranscriptEvent] {
        presentation.session(navigation.session)?.events ?? []
    }

    /// The same Session's composer, projected here for the reason the header is: this is the one
    /// view that knows what is selected. Absent — no vessel at all — for a Session Argo cannot
    /// drive.
    private var composer: SessionComposerProjection.Composer? {
        SessionComposerProjection.composer(for: presentation.session(navigation.session))
    }

    /// The composer's one intent, bound to the Session the composer addresses — inert when there
    /// is no composer, which is also when there is no field to type into.
    private var send: (String) throws -> Void {
        guard let composer else { return { _ in } }
        let sessionID = composer.sessionID
        return { try actions.sendTurn(sessionID, $0) }
    }

    /// The selected Session's pending Permission, projected here for the reason the composer is:
    /// this is the one view that knows what is selected. While present it takes the composer's
    /// slot in the deck.
    private var prompt: PermissionPromptProjection.Prompt? {
        PermissionPromptProjection.prompt(for: presentation.session(navigation.session))
    }

    /// The prompt's one intent, bound the way `send` is — inert when there is no prompt, which is
    /// also when there is nothing to answer.
    private var decide: (PermissionDecision) -> Void {
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
    private var revoke: (String) -> Void {
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
    private var handOff: () async -> Void {
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
    private var sessionCommands: SessionCommands? {
        guard let session = presentation.session(navigation.session) else { return nil }
        return SessionCommands(
            rename: { renamingSessionID = session.id },
            archive: { actions.setSessionArchived(session.id, !session.isArchived) },
            renameTitle: SessionRenameProjection.heading,
            archiveTitle: session.isArchived ? "Put Back on the Roster" : "Archive Session",
        )
    }

    public var body: some View {
        @Bindable var navigation = navigation

        NavigationSplitView {
            ShellSidebar(
                presentation: presentation,
                selection: $navigation.session,
                archive: actions.setSessionArchived,
                rename: actions.setSessionName,
                renamingSessionID: $renamingSessionID,
            )
            .navigationSplitViewColumnWidth(
                min: ArgoLayout.sidebarMinimumWidth,
                ideal: ArgoLayout.sidebarIdealWidth,
                max: ArgoLayout.sidebarMaximumWidth,
            )
        } detail: {
            InstrumentDeckShell(
                room: navigation.room,
                session: navigation.session,
                feed: feed,
                header: header,
                handOff: handOff,
                showing: showing,
                composer: composer,
                send: send,
                prompt: prompt,
                decide: decide,
                revoke: revoke,
            )
            // What the chain link at the foot of a handed-off reading does. Injected here because
            // this is the one view that holds the navigation — the same division the handoff itself
            // keeps: the app performs, and the shell decides what to point at.
            .environment(\.argoOpenSession) { fresh in navigation.session = fresh }
            .overlay(alignment: .topLeading) {
                if presentation.connection != .connected {
                    ConnectionChip(
                        connection: presentation.connection,
                        retry: actions.retryConnection,
                    )
                    .padding(ArgoSpacing.section)
                }
            }
            // On the DETAIL pane, not on the split view. A split view divides the bar into a
            // region per column, and a flexible spacer only expands inside its own — declared
            // on the split view it landed in a region that spans nothing, which left Rooms
            // parked beside the scope vessel instead of at the trailing edge.
            .toolbar {
                ShellToolbar(
                    room: $navigation.room,
                    presentation: presentation,
                    actions: actions,
                    spawn: CockpitSpawn(
                        presentation: presentation,
                        actions: actions,
                        navigation: navigation,
                    ),
                )
            }
        }
        .navigationTitle(presentation.activeProject?.name ?? "Argo")
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        .frame(
            minWidth: ArgoLayout.windowMinimumWidth,
            minHeight: ArgoLayout.windowMinimumHeight,
        )
        .argoAppearance()
        .focusedValue(\.sessionCommands, sessionCommands)
        .onChange(of: presentation.sessions.map(\.id), initial: true) { _, sessionIDs in
            navigation.reconcile(against: sessionIDs)
        }
    }
}

#Preview("Production shell — Session selected") {
    @Previewable @State var navigation = CockpitNavigationModel()

    CockpitView(
        presentation: .preview,
        actions: .inert,
    )
    .environment(navigation)
    .frame(width: 1280, height: 800)
}

#Preview("Production shell — no Sessions") {
    @Previewable @State var navigation = CockpitNavigationModel()

    CockpitView(
        presentation: .emptyPreview,
        actions: .inert,
    )
    .environment(navigation)
    .frame(width: 1080, height: 680)
}
