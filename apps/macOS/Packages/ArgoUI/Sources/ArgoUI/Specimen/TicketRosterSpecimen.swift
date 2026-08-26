import SwiftUI

/// The roster once the ticket names the row (#745) — the state the whole ticket is about, where
/// before it every row read `/implement <N>`.
///
/// Rendered at BOTH widths on purpose: the column truncates at the tail, and whether three Sessions
/// on one ticket are still told apart when the shared title cuts is a question only the narrow
/// render answers.
struct TicketRosterSpecimen: View {
    var width = ArgoLayout.sidebarIdealWidth

    var body: some View {
        List {
            ForEach(TicketFixture.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: width)
    }
}

#Preview("Ticket roster — three Sessions on one ticket") {
    TicketRosterSpecimen()
        .frame(height: 320)
        .argoAppearance()
}

#Preview("Ticket roster — at the narrowest sidebar width") {
    TicketRosterSpecimen(width: ArgoLayout.sidebarMinimumWidth)
        .frame(height: 320)
        .argoAppearance()
}
