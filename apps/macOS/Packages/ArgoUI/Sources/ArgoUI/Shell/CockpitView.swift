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
        FeedProjection.rows(from: events)
    }

    /// The same Session's plan, off the same stream. Read separately rather than pulled out of the
    /// rows, because it is not one: the plan is the standing state a whole transcript resolves to,
    /// and the feed is the sequence of moments that produced it.
    private var showing: PlanShowing {
        PlanShowing(plan: PlanProjection.reading(from: events))
    }

    private var events: [TranscriptEvent] {
        presentation.session(navigation.session)?.events ?? []
    }

    public var body: some View {
        @Bindable var navigation = navigation

        NavigationSplitView {
            ShellSidebar(presentation: presentation, selection: $navigation.session)
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
                showing: showing,
            )
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
