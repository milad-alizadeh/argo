import SwiftUI

/// Project and Session navigation sharing one uninterrupted system sidebar material.
///
/// Nothing is drawn between the two. A translucent-white hairline here changed tone down
/// its own length — the sidebar material is lighter under the toolbar than below it, so one
/// edge colour rendered as two — and D3 asks for a single continuous column anyway, which a
/// drawn line is precisely what breaks. The strip reads as its own region from its width and
/// its content, not from a rule.
struct ShellSidebar: View {
    let presentation: CockpitPresentation
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        HStack(spacing: ArgoSpacing.flush) {
            ProjectStrip(project: presentation.project)
            SessionNavigator(sessions: presentation.sessions, selection: $selection)
        }
    }
}

#Preview("Continuous sidebar") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    ShellSidebar(presentation: .preview, selection: $selection)
        .frame(width: 340, height: 600)
        .argoAppearance()
}
