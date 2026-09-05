import ArgoDesign
import AtlasLayout
import AtlasView
import SwiftUI

/// The rail the open file is read in: a column of the room beside the map, never a card over it
/// (#1154, the approved design's `#rail`).
///
/// **Beside the map, with the map still on screen.** That is the ticket's first criterion and the
/// whole reason this is a column rather than a sheet or a popover: the picture the reader was
/// looking at when they clicked has to stay in front of them while they read about it.
///
/// It is here rather than in `AtlasView` for `AtlasSidebar`'s reason: the map package draws the
/// map and the things said about one file, and where those stand in a window is the room's.
struct AtlasRoomRail: View {
    @Environment(\.argo) private var argo

    let reading: AtlasFileReading

    /// What the rail takes of the room — the design's own 356. A fixed width rather than a share:
    /// the panel is read as prose at a measure, and a rail that grew with the window would set a
    /// path across half a screen.
    static let width: CGFloat = 356

    var body: some View {
        AtlasReadingPanel(reading: reading)
            .frame(width: Self.width)
            .frame(maxHeight: .infinity)
            // The rail's own edge against the stage. A hairline is the contract's answer to two
            // surfaces of the same tone; this is two different ones, so it takes the rung above.
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(argo.color.edge.subtle)
                    .frame(width: ArgoStroke.border)
            }
    }
}
