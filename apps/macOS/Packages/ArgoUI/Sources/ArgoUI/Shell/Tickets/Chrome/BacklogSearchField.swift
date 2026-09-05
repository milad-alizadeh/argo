import ArgoDesign
import SwiftUI

/// Search, at the row's trailing edge — **a real field, not an icon that becomes one.**
///
/// It stands in for `.searchable`, which is not used here for one reason: the system's field takes
/// the width the toolbar gives it, and this one is measured at `ArgoTicketsChrome.searchWidth` so
/// it clears the trailing edge at the 1280 window. Everything else about it is the stock field —
/// focus, the escape key, and the system's own clear button.
///
/// The line inside the capsule is `SearchFieldLine`, shared with the ticket picker's own field
/// (#1231). What is left here is the capsule and the width.
///
/// **It stands exactly as tall as the icon vessels beside it** — `ArgoControlBox.vessel`, the same
/// number a capsule holding one mark comes out at. It had a 28 of its own, which made the one row
/// of controls three heights of container; a field is a container on this band like any other.
package struct BacklogSearchField: View {
    @Binding var query: String

    /// Spelled out: Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(query: Binding<String>) {
        _query = query
    }

    package var body: some View {
        SearchFieldLine(query: $query, prompt: Self.prompt)
            .frame(width: ArgoTicketsChrome.searchWidth)
            .argoFloatingGlass(in: .capsule)
    }

    static let prompt = "Search the backlog"
}

// Empty, which is the state every render of this room shows and the one the 210 was measured
// against — a typed query is the same field at the same width (`rules/swift.md`, coverage).
#Preview("Backlog search field") {
    @Previewable @State var query = ""

    BacklogSearchField(query: $query)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
