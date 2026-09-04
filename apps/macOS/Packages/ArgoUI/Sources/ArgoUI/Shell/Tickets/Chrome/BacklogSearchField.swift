import ArgoAtoms
import ArgoDesign
import SwiftUI

/// Search, at the row's trailing edge — **a real field, not an icon that becomes one.**
///
/// It stands in for `.searchable`, which is not used here for one reason: the system's field takes
/// the width the toolbar gives it, and this one is measured at `ArgoTicketsChrome.searchWidth` so
/// it clears the trailing edge at the 1280 window. Everything else about it is the stock field —
/// focus, the escape key, and the system's own clear button.
///
/// **It stands exactly as tall as the icon vessels beside it** — `ArgoControlBox.vessel`, the same
/// number a capsule holding one mark comes out at. It had a 28 of its own, which made the one row
/// of controls three heights of container; a field is a container on this band like any other.
package struct BacklogSearchField: View {
    @Environment(\.argo) private var argo

    @Binding var query: String

    /// Spelled out: Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(query: Binding<String>) {
        _query = query
    }

    package var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            ArgoGlyph(ArgoSymbol.searchBacklog, .inline)
                .foregroundStyle(argo.color.text.tertiary)
            TextField("Search the backlog", text: $query)
                .textFieldStyle(.plain)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.primary)
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(width: ArgoTicketsChrome.searchWidth, height: ArgoControlBox.vessel)
        .argoFloatingGlass(in: .capsule)
        .accessibilityLabel("Search the backlog")
    }
}

// Empty, which is the state every render of this room shows and the one the 210 was measured
// against — a typed query is the same field at the same width (`rules/swift.md`, coverage).
#Preview("Backlog search field") {
    @Previewable @State var query = ""

    BacklogSearchField(query: $query)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
