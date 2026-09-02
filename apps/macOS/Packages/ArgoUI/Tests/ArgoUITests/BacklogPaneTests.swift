import ArgoEngine
@testable import ArgoUI
import Testing

/// The Tickets room's two panes: how far the seam between them may travel, and what a row does with
/// more labels than it has width for.
@Suite("Backlog pane")
@MainActor
struct BacklogPaneTests {
    // MARK: - The seam's travel

    /// The invariant the ceiling carries, and the only one: whatever the reader drags to, the
    /// ticket detail keeps its floor.
    @Test
    func `the backlog never takes the ticket detail's floor`() {
        for deck in stride(from: 600.0, through: 2000.0, by: 37.0) {
            let limits = ArgoLayout.backlogLimits(in: deck)
            let left = deck - limits.upperBound - ArgoLayout.seamGrabWidth
            #expect(left >= ArgoLayout.ticketDetailMinimumWidth || limits.upperBound == limits
                .lowerBound)
        }
    }

    @Test
    func `the seam has travel at the narrowest window`() {
        let deck = ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth
        let limits = ArgoLayout.backlogLimits(in: deck)

        #expect(limits.upperBound > limits.lowerBound)
    }

    /// A deck too narrow for both floors is not a reason to hand back a range that runs backwards.
    @Test
    func `an impossible deck seats on the floor rather than inverting`() {
        let limits = ArgoLayout.backlogLimits(in: 200)

        #expect(limits.lowerBound == ArgoLayout.backlogWidths.lowerBound)
        #expect(limits.upperBound == limits.lowerBound)
    }

    /// The pane OPENS at the measure the twelve real titles were chosen against, so at the ideal
    /// window nothing seats it away from there before the reader has touched it.
    @Test
    func `the opening width stands at the ideal window`() {
        let deck = ArgoLayout.windowIdealWidth - ArgoLayout.sidebarMinimumWidth
        let limits = ArgoLayout.backlogLimits(in: deck)

        #expect(ArgoLayout.seated(ArgoBacklogList.width, in: limits) == ArgoBacklogList.width)
    }

    /// Every prose pane in the app stops at one number. Three constants that merely happen to be
    /// 320 today would drift the moment one of them was tuned.
    @Test
    func `the prose panes share one floor`() {
        #expect(ArgoLayout.ticketDetailMinimumWidth == ArgoLayout.proseColumnMinimumWidth)
        #expect(ArgoLayout.feedMinimumWidth == ArgoLayout.proseColumnMinimumWidth)
        #expect(ArgoLayout.evidencePanelMinimumWidth == ArgoLayout.proseColumnMinimumWidth)
    }

    // MARK: - A row's labels

    /// The cut is about names and widths, so these cases state names and let the colour be the
    /// silence it is on a provider that served none.
    private func named(_ names: String...) -> [TicketLabel] {
        names.map { TicketLabel(name: $0) }
    }

    @Test
    func `a row draws its labels in the provider's own order`() {
        let reading = BacklogRowLabels(named("ui", "work-room"), limit: 2)

        #expect(reading.shown.map(\.name) == ["ui", "work-room"])
        #expect(reading.overflow == 0)
        #expect(reading.marker == nil)
    }

    /// The finding this exists for: silence about the rest leaves a ticket whose distinguishing
    /// label is third looking like one with two labels.
    @Test
    func `labels past the limit are counted rather than dropped silently`() {
        let reading = BacklogRowLabels(named("ui", "work-room", "blocked", "prd"), limit: 2)

        #expect(reading.shown.map(\.name) == ["ui", "work-room"])
        #expect(reading.marker == "+2")
    }

    /// Speech and pixels answer the same question the same way. Taken straight off `labels`, the
    /// announcement named marks the row was not drawing.
    @Test
    func `what is spoken is what is drawn, plus the count of what is not`() {
        let reading = BacklogRowLabels(named("ui", "work-room", "blocked"), limit: 2)

        #expect(reading.spoken == ["ui", "work-room", "1 more"])
    }

    @Test
    func `a ticket with no labels says nothing about them`() {
        let reading = BacklogRowLabels([])

        #expect(reading.shown.isEmpty)
        #expect(reading.marker == nil)
        #expect(reading.spoken.isEmpty)
    }

    /// The projection carries the labels through verbatim, so the row has something to cut.
    @Test
    func `a backlog row carries the provider's labels`() {
        let room = TicketsRoomProjection.room(from: TicketsFixture.reading)
        let wayfinder = room.backlog.first { $0.id == 607 }

        #expect(wayfinder?.labels.map(\.name) == ["wayfinder", "work-room", "prd"])
    }
}
