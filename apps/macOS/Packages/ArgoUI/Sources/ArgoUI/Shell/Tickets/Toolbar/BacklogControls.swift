import SwiftUI

/// The list's own two controls: filter, then the menu that holds every other way to order it —
/// Mail's own pair, in Mail's own order. The rule between them is what stops one capsule reading as
/// one control.
///
/// In the window's row rather than over the column it narrows: nothing about a filter mark says
/// which column it acts on, and this room has one list to narrow.
struct BacklogControls: View {
    var narrowing: () -> Void = {}
    var grouping: () -> Void = {}

    var body: some View {
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.filterBacklog, label: "Filter", act: narrowing)
            DeckSeparator()
                .frame(height: ArgoTicketsChrome.splitDividerHeight)
                .accessibilityHidden(true)
            BacklogMenu(grouping: grouping)
        }
    }
}

#Preview("Backlog controls") {
    BacklogControls()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
