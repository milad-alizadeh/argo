import SwiftUI

/// Session navigation on the system sidebar material.
///
/// The Project strip is gone: switching Projects is the toolbar vessel's drawer now, and leaving
/// the strip beside it put two switchers on screen with two different ideas of which Project was
/// active — the initialled mark that sent this surface out of the sidebar in the first place, plus
/// an amber dot still meaning "folder not found" where the drawer says it in words.
struct ShellSidebar: View {
    let presentation: CockpitPresentation
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        SessionNavigator(sessions: presentation.sessions, selection: $selection)
    }
}

#Preview("Continuous sidebar") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    ShellSidebar(presentation: .preview, selection: $selection)
        .frame(width: 340, height: 600)
        .argoAppearance()
}
