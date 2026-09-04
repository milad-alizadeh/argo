import ArgoDesign
import SwiftUI

/// The LIST pane's own header band: New ticket at the pane's leading edge, the search field at its
/// trailing one (#1242).
///
/// Both act on the list, which is why both are here rather than in a window-wide row — a control
/// placed relative to the window's trailing edge and a pane whose leading edge the reader can drag
/// are two independent numbers, and they coincided by luck.
struct BacklogPaneHeader: View {
    /// How far the band climbs into the window's strip, measured by the deck and handed down.
    var reach: CGFloat = 0
    var creation = TicketsChromeIntents.Creation()
    /// Whether the list-scoped control stands. `narrows` and not `draws`: the field goes with the
    /// list it searches, so an empty backlog loses it where New ticket survives.
    var narrows = false
    var query: Binding<String> = .constant("")

    var body: some View {
        TicketsPaneHeader(reach: reach, inset: ArgoBacklogList.bandInsetX) {
            NewTicketButton(creation: creation)
        } trailing: {
            if narrows {
                BacklogSearchField(query: query)
            }
        }
    }
}

#Preview("Backlog pane header") {
    BacklogPaneHeader(narrows: true)
        .frame(width: ArgoBacklogList.width)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog pane header — an empty backlog keeps New ticket") {
    BacklogPaneHeader()
        .frame(width: ArgoBacklogList.width)
        .argoDeckSurface()
        .argoAppearance()
}
