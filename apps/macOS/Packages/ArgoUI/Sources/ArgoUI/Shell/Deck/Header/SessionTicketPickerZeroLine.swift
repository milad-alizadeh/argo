import ArgoDesign
import SwiftUI

/// The one line the ticket picker draws when the query kept nothing (#1231).
///
/// It stands exactly one row tall, so a query that narrows to nothing shrinks the picker to its
/// smallest rather than collapsing it: a surface that vanished under the reader's own typing
/// would read as the picker having closed, and the next character they type would go nowhere.
struct SessionTicketPickerZeroLine: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Text(Self.words)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.tertiary)
            .lineLimit(1)
            .padding(.horizontal, ArgoSpacing.base)
            .frame(height: ArgoTicketPicker.rowHeight, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
    }

    /// A statement about the open backlog, not about the query: the reader can see what they
    /// typed, and what they cannot see is that closed Tickets were never on offer here.
    static let words = "No open Ticket matches."
}
