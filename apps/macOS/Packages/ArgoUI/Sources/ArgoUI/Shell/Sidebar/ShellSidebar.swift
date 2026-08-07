import SwiftUI

/// Project and Session navigation sharing one uninterrupted system sidebar material.
struct ShellSidebar: View {
    @Environment(\.argo) private var argo
    @Environment(\.colorSchemeContrast) private var contrast

    let presentation: CockpitPresentation
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            ProjectStrip(project: presentation.project)
            Divider().overlay(separator)
            SessionNavigator(sessions: presentation.sessions, selection: $selection)
        }
    }

    private var separator: ArgoColor {
        contrast == .increased ? argo.color.edge.strong : argo.color.edge.hairline
    }
}

#Preview("Continuous sidebar") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    ShellSidebar(presentation: .preview, selection: $selection)
        .frame(width: 340, height: 600)
        .argoAppearance()
}
