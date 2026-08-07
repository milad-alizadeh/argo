import SwiftUI

/// Native Sessions navigation; #377 owns the richer production row content.
struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    let sessions: [CockpitPresentation.Session]
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        List(selection: $selection) {
            Section {
                if sessions.isEmpty {
                    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                        Text("No sessions yet")
                            .argoText(ArgoTypography.rowTitle)
                        Text("Observed Sessions appear here.")
                            .argoText(ArgoTypography.rowMeta)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                    .padding(.vertical, ArgoSpacing.tight)
                } else {
                    ForEach(sessions) { session in
                        Text(session.title)
                            .argoText(ArgoTypography.rowTitle)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .help(session.title)
                            .tag(session.id)
                    }
                }
            } header: {
                Text("Sessions")
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
        .listStyle(.sidebar)
    }
}

#Preview("Sessions navigation") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    SessionNavigator(sessions: CockpitPresentation.preview.sessions, selection: $selection)
        .frame(width: 280, height: 480)
        .argoAppearance()
}
