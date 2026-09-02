import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Priority headers — the three bands, and the one nobody read") {
    let roots = TicketsFixture.room.backlog

    VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
        ForEach(TicketsRoomProjection.bands(of: roots)) { band in
            PriorityHeader(band: band, count: TicketsRoomProjection.drawn(band, shut: []).count)
        }
        PriorityHeader(band: TicketsRoomProjection.Band(priority: nil, roots: []), count: 0)
    }
    .frame(width: ArgoBacklogList.width, alignment: .leading)
    .argoDeckSurface()
    .argoAppearance()
}
