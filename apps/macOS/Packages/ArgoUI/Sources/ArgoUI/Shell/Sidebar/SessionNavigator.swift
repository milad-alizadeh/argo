import SwiftUI

/// Native Sessions navigation with stable, information-dense rows.
struct SessionNavigator: View {
    @Environment(\.argo) private var argo

    let sessions: [CockpitPresentation.Session]
    @Binding var selection: CockpitPresentation.Session.ID?

    var body: some View {
        List(selection: $selection) {
            if sessions.isEmpty {
                ZStack { emptyState }
            } else {
                ForEach(SessionRosterProjection.rows(from: sessions)) { row in
                    // Apple's own workaround for a known Xcode bug: a custom row directly
                    // inside a List's ForEach kills the macOS preview in
                    // TableViewListCore_Mac2. Costs nothing at runtime, where it has never
                    // crashed — the app has been launching fine throughout.
                    ZStack { SessionRow(row: row) }.tag(row.id)
                }
            }
        }
        // `.sidebar` is what makes `List` inherit the window's system material (D3) — the
        // roster must never opt out of it for a styled list, and the system's own rounded
        // capsule is therefore the selection wash (D30, amended).
        //
        // Its colour is NOT settable here. SwiftUI ignores `.tint` for a macOS sidebar's
        // selection and takes it from the `AccentColor` asset instead, so Ion Blue is
        // declared in `Argo/Assets.xcassets` and this call site stays out of it. Judge the
        // result on an ACTIVE window: an inactive one draws selection in the system's grey
        // whatever the accent says, which is why this looked neutral for two rounds.
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
