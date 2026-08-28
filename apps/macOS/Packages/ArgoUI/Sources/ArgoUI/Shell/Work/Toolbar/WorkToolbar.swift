import SwiftUI

/// What the Work room puts in the WINDOW's toolbar row: search, at the trailing edge. That is all.
///
/// A toolbar item is laid out from the window's leading edge, so it cannot be placed against a
/// column; anything that acts on one is in that column's band instead — `BacklogHeader`,
/// `TicketBand`. The column question is settled in `cockpit-work-room.md` (#836).
///
/// **Search stays here because it is the window's.** Mail keeps its field at the window's trailing
/// edge too, and searches the list with it: the toolbar is one row, not three.
struct WorkToolbar: ToolbarContent {
    let reading: WorkChromeProjection.Reading
    /// What the field HOLDS. The room does not read it back — the query outlives the pane, so it is
    /// held above the room with the rest of the window's state.
    var query: Binding<String> = .constant("")

    @ToolbarContentBuilder var body: some ToolbarContent {
        // `narrows` and not `draws`: search goes with the list it searches, so an empty backlog
        // loses it where New ticket in the band below survives.
        if reading.narrows {
            // The region packs from its own leading edge, which is where `ShellToolbar`'s items
            // end — without this the field sits against the scope vessel rather than at the
            // window's trailing edge, where the HIG puts a search field and where Mail's is.
            ToolbarSpacer(.flexible, placement: .primaryAction)
            ToolbarItem(placement: .primaryAction) {
                BacklogSearchField(query: query)
            }
            // The field draws its own glass, so the shared background the toolbar puts behind a
            // region would stack a second capsule under it.
            .sharedBackgroundVisibility(.hidden)
        }
    }
}
