import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    let sessions: [CockpitPresentation.Session]
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        List(selection: $selection) {
            Section {
                if sessions.isEmpty {
                    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                        Text("No Sessions yet")
                            .argoText(ArgoTypography.rowTitle)
                        Text("Observed Sessions appear here.")
                            .argoText(ArgoTypography.rowMeta)
                            .foregroundStyle(argo.color.text.tertiary)
                    }
                    .padding(.vertical, ArgoSpacing.tight)
                } else {
                    ForEach(SessionRosterProjection.rows(from: sessions)) { row in
                        SessionRow(row: row, isSelected: row.id == selection)
                            .tag(row.id)
                    }
                }
            } header: {
                Text("Sessions")
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
            }
        }
        .listStyle(.sidebar)
        .tint(argo.color.surface.selected)
    }
}

#Preview("Sessions navigation") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    SessionNavigator(sessions: CockpitPresentation.preview.sessions, selection: $selection)
        .frame(width: 280, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — no selection") {
    SessionNavigator(sessions: CockpitPresentation.preview.sessions, selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — empty") {
    SessionNavigator(sessions: [], selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}
