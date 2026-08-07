import SwiftUI

/// Project and Session navigation sharing one uninterrupted system sidebar material.
///
/// Nothing may be drawn between them: a hairline here renders as two tones, because the
/// material is lighter under the toolbar than below it (D3).
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
