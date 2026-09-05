import ArgoDesign
import AtlasLayout
import AtlasView
import SwiftUI

/// The rail beside the map: the index of every file the map is drawing, and the one file being
/// read (#1154, #1155, the approved design's `#rail`).
///
/// **Beside the map, with the map still on screen.** That is #1154's first criterion and the whole
/// reason this is a column rather than a sheet or a popover: the picture the reader was looking at
/// when they clicked has to stay in front of them while they read about it.
///
/// **Split once and never again.** The half above is always the list and the half below is always
/// the one thing being read — neither replaces the other. A single region that swapped its whole
/// contents destroyed the list a reader was choosing from at the moment they chose, and a reading
/// that appeared and vanished moved the list on every click.
///
/// It is here rather than in `AtlasView` for `AtlasSidebar`'s reason: the map package draws the
/// map, the list and the things said about one file, and where those stand in a window is the
/// room's.
struct AtlasRoomRail: View {
    @Environment(\.argo) private var argo

    @Binding var query: String

    /// Every file the map is drawing, as the reader's question leaves it.
    let entries: [AtlasIndexEntry]

    /// The file open in both halves at once: the row it marks in the list is the volume it traces
    /// on the map, because it is one value and there is nowhere for a second to disagree from.
    let open: String?

    /// What is read below, or none — a file the map has no measured reading for closes the
    /// reading rather than showing an empty one.
    let reading: AtlasFileReading?

    let select: (String) -> Void

    /// What the rail takes of the room — the design's own 356. A fixed width rather than a share:
    /// the panel is read as prose at a measure, and a rail that grew with the window would set a
    /// path across half a screen.
    static let width: CGFloat = 356

    /// What the reading takes of the rail — the design's own 322, and ONE height always. A region
    /// that grew and shrank with what was picked moved the list above it on every click, which
    /// costs more than the space it saves.
    static let readingHeight: CGFloat = 322

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            AtlasIndex(query: $query, entries: entries, open: open, select: select)
            inspect
        }
        .frame(width: Self.width)
        .frame(maxHeight: .infinity)
        .background(argo.color.surface.sunken.color)
        // The rail's own edge against the stage. A hairline is the contract's answer to two
        // surfaces of the same tone; this is two different ones, so it takes the rung above.
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(argo.color.edge.subtle)
                .frame(width: ArgoStroke.border)
        }
    }

    private var inspect: some View {
        Group {
            if let reading {
                AtlasReadingPanel(reading: reading)
            } else {
                AtlasReadingIdle()
            }
        }
        .frame(height: Self.readingHeight)
        .background(argo.color.surface.base.color)
        // The one boundary inside the rail, and the loudest edge in it: the two regions answer
        // different questions, and a hairline between them would read as a row separator.
        .overlay(alignment: .top) {
            Rectangle()
                .fill(argo.color.edge.strong)
                .frame(height: ArgoStroke.border)
        }
    }
}
