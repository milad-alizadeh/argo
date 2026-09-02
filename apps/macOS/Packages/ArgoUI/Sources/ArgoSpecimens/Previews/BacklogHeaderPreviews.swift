import ArgoUI
import SwiftUI

#Preview("Backlog header") {
    BacklogHeader(
        reading: TicketsChromeProjection.reading(
            of: TicketsFixture.room, in: .allOpen, showing: 272,
        ),
    )
    .frame(width: ArgoBacklogList.width)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Backlog header — the provider answered with nothing") {
    BacklogHeader(
        reading: TicketsChromeProjection.reading(
            of: TicketsRoomProjection.room(from: TicketsFixture.answeredEmpty),
            in: .allOpen,
            showing: nil,
        ),
    )
    .frame(width: ArgoBacklogList.width)
    .argoDeckSurface()
    .argoAppearance()
}
