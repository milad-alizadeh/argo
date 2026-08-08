import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    let rows: [SessionRosterProjection.Row]
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        List(selection: $selection) {
            if rows.isEmpty {
                emptyState.previewSafeListRow()
            } else {
                ForEach(rows) { row in
                    SessionRow(row: row).previewSafeListRow().tag(row.id)
                }
            }
        }
        // `.sidebar` carries the window's system material (D3), so the roster may not trade
        // it for a styled list. Selection is that style's own capsule, coloured from the
        // `AccentColor` asset — SwiftUI's `.tint` does not reach it (D30).
        .listStyle(.sidebar)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            Text("No Sessions yet")
                .argoText(ArgoTypography.rowTitle)
            Text("Observed Sessions appear here.")
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.tertiary)
        }
        .padding(.vertical, ArgoSpacing.tight)
        .listRowSeparator(.hidden)
    }
}

#Preview("Sessions navigation") {
    @Previewable @State var selection = CockpitPresentation.preview.sessions.first?.id

    SessionNavigator(rows: SessionRosterProjection.previewRows, selection: $selection)
        .frame(width: 280, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — no selection") {
    SessionNavigator(rows: SessionRosterProjection.previewRows, selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}

#Preview("Sessions navigation — empty") {
    SessionNavigator(rows: [], selection: .constant(nil))
        .frame(width: 320, height: 480)
        .argoAppearance()
}
