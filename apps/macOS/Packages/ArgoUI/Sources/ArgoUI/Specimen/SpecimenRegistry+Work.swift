import SwiftUI

/// The Work room (#812, #815, #816, #817, #818): the room at rest, its two vacancies, the ticket's
/// own states, the hero's tiers, the marks it spends on a Delivery, and the toolbar row's three.
extension SpecimenRegistry {
    static let work: [SpecimenEntry] = [
        SpecimenEntry("workRoom") { WorkRoomSpecimen() },
        // Nothing bound: the room hides WHOLE — no sidebar, no list, no ticket, and a panel saying
        // nothing has been read rather than that there is nothing. `unbound.png`.
        SpecimenEntry("unboundWorkRoom") { WorkPanesSpecimen(reading: WorkFixture.unbound) },
        // The provider answered, and the answer was nothing: the sidebar and its views stay, all
        // reading zero, and the deck says WHO answered. `empty.png`. The pair is the point — either
        // page alone lets a reader read "empty backlog" off a room nobody asked (#818).
        SpecimenEntry("emptyWorkBacklog") { WorkPanesSpecimen(reading: WorkFixture.answeredEmpty) },
        // The view is what the DECK draws, not just a number in the rail — the one render that
        // shows the sidebar's selection reaching the pane beside it.
        SpecimenEntry("blockedWorkView") {
            WorkPanesSpecimen(reading: WorkFixture.reading, opening: .init(view: .blocked))
        },
        // The hero's three degraded tiers and its one-chip state (#817). Each is its own reading
        // rather than its own card: the tier is arithmetic over the backlog, so a specimen that
        // handed the card a literal would prove the card and not the room.
        SpecimenEntry("nothingUnblocked") { WorkPanesSpecimen(reading: WorkFixture.poolBlocked) },
        SpecimenEntry("everythingRunning") { WorkPanesSpecimen(reading: WorkFixture.poolRunning) },
        SpecimenEntry("oneEarnedChip") { WorkPanesSpecimen(reading: WorkFixture.oneChip) },
        // A parent FOLDED, open in the pane beside it (#814): the twist shut, its roll-up standing
        // in for the five rows it is holding, and the Children section naming them anyway. It is
        // seeded rather than clicked because everything opens open.
        SpecimenEntry("collapsedWorkBacklog") {
            WorkPanesSpecimen(
                reading: WorkFixture.reading(showing: 607),
                opening: .init(folded: [607]),
            )
        },
        SpecimenEntry("deliveryDots") { DeliveryDotsSpecimen() },
        // A parent, deep: two Deliveries stacked, nine children rolled up over the five that are
        // open, and six blockers of which four are already closed and still named.
        SpecimenEntry("deepTicket") {
            TicketDetailSpecimen(reading: WorkFixture.reading(showing: 607))
        },
        // `deep.png` is a WHOLE-room shot, so the pane above is not the whole of it: this opens
        // the room on the same parent.
        SpecimenEntry("deepWorkRoom") {
            WorkPanesSpecimen(reading: WorkFixture.reading(showing: 607))
        },
        // A provider that exposes no dependency edges. The `Blocked by` section is ABSENT, not
        // empty — nobody has told us there are no blockers.
        SpecimenEntry("edgelessTicket") { TicketDetailSpecimen(reading: WorkFixture.edgeless) },
        SpecimenEntry("deliveryChips") { DeliveryChipsSpecimen() },
        // The fact strip's floor: a ticket the provider named and said nothing else about. Every
        // absent fact is left out, and Argo's own bucket is the one that survives.
        SpecimenEntry("unreadTicket") { TicketDetailSpecimen(reading: WorkFixture.unread) },
        // The toolbar row alone, in its three states (#816). At rest it is read off `workRoom`
        // above, over the panes it places its controls against; these two are the vacancies, which
        // differ in nothing BUT the row.
        SpecimenEntry("workToolbar") { WorkToolbarSpecimen(reading: WorkFixture.reading) },
        SpecimenEntry("emptyWorkToolbar") {
            WorkToolbarSpecimen(reading: WorkFixture.answeredEmpty)
        },
        SpecimenEntry("unboundWorkToolbar") { WorkToolbarSpecimen(reading: WorkFixture.unbound) },
        // The Route (#335). `route.png` is shot at a 1600 window rather than 1280, because the
        // canvas widens when the work needs room rather than compressing to fit.
        SpecimenEntry("chartRoute") {
            WorkPanesSpecimen(
                reading: WorkFixture.reading,
                opening: .chart(WorkFixture.chart, .map),
            )
        },
        // The same chart as its tree, which is what the toggle switches between.
        SpecimenEntry("chartTree") {
            WorkPanesSpecimen(
                reading: WorkFixture.reading,
                opening: .chart(WorkFixture.chart, .tree),
            )
        },
        // Day one: every open child blocked, the line at the LEFT WALL with all of the work ahead
        // of it. The state that must not read as finished, which is why waiting is a quiet neutral.
        SpecimenEntry("dayOneRoute") { RouteCanvasSpecimen(room: WorkFixture.dayOneChartRoom) },
        // The same chart finished: the line has walked past all of the work.
        SpecimenEntry("resolvedRoute") { RouteCanvasSpecimen(room: WorkFixture.resolvedChartRoom) },
        // Closed work past one column's row cap, so the band wraps into a second column and the
        // line stands a column further right — its position is the progress bar.
        SpecimenEntry("longTailRoute") { RouteCanvasSpecimen(room: WorkFixture.longTailChartRoom) },
        // A provider serving no edges at all: every open child answers an unknown distance, so the
        // route collapses to one takeable column rather than failing.
        SpecimenEntry("edgelessRoute") { RouteCanvasSpecimen(room: WorkFixture.edgelessChartRoom) },
        // The toggle alone: both positions, and the disabled state a chart with no Route leaves it.
        SpecimenEntry("roomPresentation") { RoomPresentationSpecimen() },
    ]
}
