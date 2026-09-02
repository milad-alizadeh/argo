import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Backlog outline — open, and with one parent folded") {
    @Previewable @State var open = Set<Int>()
    @Previewable @State var folded: Set = [607]
    let high = TicketsRoomProjection.bands(of: TicketsFixture.room.backlog)[0]

    HStack(spacing: ArgoSpacing.flush) {
        List {
            BacklogOutline(
                drawn: TicketsRoomProjection.drawn(high, shut: open), shut: $open, selection: 272,
            )
        }
        List {
            BacklogOutline(drawn: TicketsRoomProjection.drawn(high, shut: folded), shut: $folded)
        }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width * 2, height: 420)
    .argoDeckSurface()
    .argoAppearance()
    .environment(\.backlogNow, TicketsFixture.asOf)
}

#Preview("Backlog outline — the provider answered with nothing") {
    List { BacklogOutline(drawn: [], shut: .constant([])) }
        .listStyle(.inset)
        .frame(width: ArgoBacklogList.width, height: 240)
        .argoDeckSurface()
        .argoAppearance()
        .environment(\.backlogNow, TicketsFixture.asOf)
}
