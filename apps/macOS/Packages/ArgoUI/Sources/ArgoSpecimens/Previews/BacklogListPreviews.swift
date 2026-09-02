import ArgoUI
import SwiftUI

#Preview("Backlog list — everything open") {
    @Previewable @State var selection: Int? = 272
    @Previewable @State var shut: Set<Int> = []

    BacklogList(
        rows: TicketsFixture.room.backlog,
        held: .init(selection: $selection, shut: $shut),
    )
    .frame(width: ArgoBacklogList.width, height: 520)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Backlog list — a parent folded, and its header's count with it") {
    @Previewable @State var selection: Int? = 607
    @Previewable @State var shut: Set = [607]

    BacklogList(
        rows: TicketsFixture.room.backlog,
        held: .init(selection: $selection, shut: $shut),
    )
    .frame(width: ArgoBacklogList.width, height: 520)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Backlog list — nobody read a priority") {
    @Previewable @State var shut: Set<Int> = []
    let unread = TicketsRoomProjection.room(from: TicketsFixture.reading(of: TicketsFixture.items))
        .backlog

    BacklogList(rows: unread, held: .init(selection: .constant(nil), shut: $shut))
        .frame(width: ArgoBacklogList.width, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog list — closed, flat, with another page behind it") {
    @Previewable @State var selection: Int? = 264
    @Previewable @State var shut: Set<Int> = []
    let room = TicketsRoomProjection.room(from: TicketsFixture.closedMore, in: .closed)

    BacklogList(
        rows: room.backlog,
        held: .init(selection: $selection, shut: $shut),
        header: TicketsChromeProjection.reading(of: room, in: .closed, showing: selection),
        more: {},
    )
    .frame(width: ArgoBacklogList.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
    .environment(\.backlogNow, TicketsFixture.asOf)
}

#Preview("Backlog list — closed, the provider served its last page") {
    @Previewable @State var shut: Set<Int> = []
    let room = TicketsRoomProjection.room(from: TicketsFixture.closedRead, in: .closed)

    BacklogList(
        rows: room.backlog,
        held: .init(selection: .constant(nil), shut: $shut),
        header: TicketsChromeProjection.reading(of: room, in: .closed, showing: nil),
    )
    .frame(width: ArgoBacklogList.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
    .environment(\.backlogNow, TicketsFixture.asOf)
}
