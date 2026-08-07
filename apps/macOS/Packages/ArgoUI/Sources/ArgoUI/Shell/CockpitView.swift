import SwiftUI

/// The production application shell: native navigation, one opaque deck, and two glass vessels.
public struct CockpitView: View {
    private let presentation: CockpitPresentation
    @Binding private var room: CockpitRoom
    private let actions: CockpitActions
    @State private var selection: CockpitPresentation.Session.ID?

    public init(
        presentation: CockpitPresentation,
        room: Binding<CockpitRoom>,
        actions: CockpitActions,
    ) {
        self.presentation = presentation
        _room = room
        self.actions = actions
        _selection = State(initialValue: presentation.sessions.first?.id)
    }

    public var body: some View {
        NavigationSplitView {
            ShellSidebar(presentation: presentation, selection: $selection)
                .navigationSplitViewColumnWidth(
                    min: ArgoLayout.sidebarMinimumWidth,
                    ideal: ArgoLayout.sidebarIdealWidth,
                    max: ArgoLayout.sidebarMaximumWidth,
                )
        } detail: {
            InstrumentDeckShell(room: room)
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
            ShellToolbar(room: $room, presentation: presentation, actions: actions)
        }
        .toolbarBackgroundVisibility(.hidden, for: .windowToolbar)
        .frame(
            minWidth: ArgoLayout.windowMinimumWidth,
            minHeight: ArgoLayout.windowMinimumHeight,
        )
        .argoAppearance()
        .onChange(of: presentation.sessions.map(\.id), initial: true) { _, sessionIDs in
            if let selection, sessionIDs.contains(selection) { return }
            selection = sessionIDs.first
        }
    }

}

#Preview("Production shell — Session selected") {
    @Previewable @State var room = CockpitRoom.sessions

    CockpitView(
        presentation: .preview,
        room: $room,
        actions: CockpitActions(refreshCheckout: {}, retryConnection: {}),
    )
    .frame(width: 1280, height: 800)
}

#Preview("Production shell — no Sessions") {
    @Previewable @State var room = CockpitRoom.sessions

    CockpitView(
        presentation: .emptyPreview,
        room: $room,
        actions: CockpitActions(refreshCheckout: {}, retryConnection: {}),
    )
    .frame(width: 1080, height: 680)
}
