import ArgoDesign
import ArgoUI
import SwiftUI

/// The roster with three Sessions on one ticket and one alone on another (#745, #1072): the shared
/// ticket names none of the three apart, so each reads its own derived title with `#741` on the
/// line below, and the row that owns its ticket still reads the ticket's words.
///
/// Rendered at BOTH widths on purpose: the column truncates at the tail, and whether the three are
/// still told apart when their own titles cut is a question only the narrow render answers.
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
