import ArgoEngine
import SwiftUI

/// The production application shell: native navigation, one opaque deck, and two glass vessels.
///
/// The one place in the shell that reads the navigation model. Everything below it takes values
/// and bindings, so each piece still renders from a `#Preview` or a specimen without one.
/// What the selected Session's controls are bound to lives in `CockpitView+Intents.swift`, which
/// is why the four below are not `private`: they are the shell's own state, read by that file and
/// by nothing else (the same division `SpecimenScreen` keeps with its case helpers).
public struct CockpitView: View {
    let presentation: CockpitPresentation
    let actions: CockpitActions
    /// The Connect panel, when it is up. Closed by default so every preview and specimen of the
    /// shell renders the shell rather than a sheet nobody asked for.
    private let connect: ConnectSurface
    /// How the active Project's provider Bindings are reading. Beside the presentation rather than
    /// inside it because it is not a Hub fact: the cockpit is a projection of the Hub, and Accounts
    /// and Bindings are registry facts the Hub has never heard of.
    private let health: ConnectionHealthReading
    @Environment(CockpitNavigationModel.self) var navigation
    /// Which roster row has its name field open. Held here rather than in the sidebar because the
    /// menu bar reaches it (`sessionCommands`), and the menu bar is outside the sidebar.
    @State var renamingSessionID: String?
    /// Every Session's unsent words. Held at the top of the shell because that is the one place
    /// above the deck's per-Session identity: the deck is rebuilt whole on a switch, so a draft
    /// kept any lower would leave with the selection rather than be waiting on the way back (#539).
    @State var drafts = ComposerDrafts()

    public init(
        presentation: CockpitPresentation,
        actions: CockpitActions,
        connect: ConnectSurface = .closed,
        health: ConnectionHealthReading = .quiet,
    ) {
        self.presentation = presentation
        self.actions = actions
        self.connect = connect
        self.health = health
    }

    /// The selected Session's reading, projected here because this is the one view that knows what
    /// is selected. Recomputed on every update rather than cached: the presentation is a value the
    /// Hub rebuilds as the transcript grows, so a feed that memoised would be showing the reading
    /// as it was when the user last clicked.
    private var feed: [FeedRow] {
        FeedProjection.rows(
            from: events,
            handedOff: presentation.handoff(of: navigation.session),
            expired: presentation.session(navigation.session)?.expiredPermissions ?? [],
        )
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
    var composer: SessionComposerProjection.Composer? {
        guard let session = presentation.session(navigation.session) else { return nil }
        return SessionComposerProjection.composer(
            for: session,
            canAttach: actions.canAttach(session.id),
        )
    }

    /// The selected Session's pending Permission, projected here for the reason the composer is:
    /// this is the one view that knows what is selected. While present it takes the composer's
    /// slot in the deck.
    var prompt: PermissionPromptProjection.Prompt? {
        PermissionPromptProjection.prompt(for: presentation.session(navigation.session))
    }

    /// The sheet is up exactly while there is a reading. Dismissing it — Escape, or the system's
    /// own gesture — runs the same intent the button does, so the panel has one way to close and
    /// the app is never left holding a panel the window has already put away.
    private var isConnecting: Binding<Bool> {
        Binding(
            get: { connect.reading != nil },
            set: { isOpen in
                guard !isOpen else { return }
                connect.actions.finish()
            },
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
                draft: draft,
            )
            // What the chain link at the foot of a handed-off reading does. Injected here because
            // this is the one view that holds the navigation — the same division the handoff itself
            // keeps: the app performs, and the shell decides what to point at.
            .environment(\.argoOpenSession) { fresh in navigation.session = fresh }
            .overlay(alignment: .topLeading) {
                ConnectionChips(
                    presentation: presentation,
                    health: health,
                    actions: actions,
                )
                .padding(ArgoSpacing.section)
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
        .sheet(isPresented: isConnecting) {
            if let reading = connect.reading {
                ConnectSheet(
                    reading: reading,
                    actions: connect.actions,
                    startsAtWelcome: connect.startsAtWelcome,
                )
            }
        }
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
