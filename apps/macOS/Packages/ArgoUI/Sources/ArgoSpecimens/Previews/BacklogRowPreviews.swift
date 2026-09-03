import ArgoAtoms
import ArgoUI
import SwiftUI

#Preview("Backlog rows — a roll-up, an odd priority, a blockage mark and an age") {
    // The band is read inline: a `let` above the view would need a `return`, which the builder
    // this body is refuses.
    List {
        ForEach(TicketsRoomProjection.drawn(
            TicketsRoomProjection.bands(of: TicketsFixture.room.backlog)[0], shut: [],
        )) { drawn in
            // The ground with the ink, the way the outline pairs them: an ink read on the
            // selection ground over the deck would preview a state the app never draws.
            let isSelected = drawn.id == 272
            let ink = BacklogRowInk(
                isSelected: isSelected, isRail: drawn.row.isRail, palette: .graphite,
            )
            BacklogRow(drawn: drawn, isOpen: true, ink: ink, toggle: drawn.isParent ? {} : nil)
                .previewSafeListRow()
                .argoSelectedRowGround(isSelected: isSelected)
        }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
    .environment(\.backlogNow, TicketsFixture.asOf)
}
