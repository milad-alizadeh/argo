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
            InstrumentDeckShell(room: navigation.room)
                .overlay(alignment: .topLeading) {
                    if presentation.connection != .healthy {
                        ConnectionChip(
                            connection: presentation.connection,
                            retry: actions.retryConnection,
                        )
                        .padding(ArgoSpacing.section)
                    }
                }
        }
        .navigationTitle(presentation.project.name)
        .toolbar {
            ShellToolbar(room: $navigation.room, presentation: presentation, actions: actions)
        }
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
        actions: CockpitActions(refreshCheckout: {}, retryConnection: {}),
    )
    .environment(navigation)
    .frame(width: 1280, height: 800)
}

#Preview("Production shell — no Sessions") {
    @Previewable @State var navigation = CockpitNavigationModel()

    CockpitView(
        presentation: .emptyPreview,
        actions: CockpitActions(refreshCheckout: {}, retryConnection: {}),
    )
    .environment(navigation)
    .frame(width: 1080, height: 680)
}
