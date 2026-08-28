import SwiftUI

/// Search, at the row's trailing edge — **a real field, not an icon that becomes one.**
///
/// It stands in for `.searchable`, which is not used here for one reason: the system's field takes
/// the width the toolbar gives it, and this one is measured at `ArgoTicketsChrome.searchWidth` so
/// it clears the trailing edge at the 1280 window. Everything else about it is the stock field —
/// focus, the escape key, and the system's own clear button.
///
/// **It sits over the ticket and searches the list.** That is Mail's own split, and for Mail's
/// reason: the toolbar is one row, not three.
struct BacklogSearchField: View {
    @Environment(\.argo) private var argo

    @Binding var query: String

    var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.searchBacklog, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            TextField("Search the backlog", text: $query)
                .textFieldStyle(.plain)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.primary)
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(width: ArgoTicketsChrome.searchWidth, height: ArgoTicketsChrome.searchHeight)
        .argoFloatingGlass(in: .capsule)
        .accessibilityLabel("Search the backlog")
    }
}

// Empty, which is the state every render of this room shows and the one the 210 was measured
// against — a typed query is the same field at the same width (`ui-components.md`, coverage).
#Preview("Backlog search field") {
    @Previewable @State var query = ""

    BacklogSearchField(query: $query)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
