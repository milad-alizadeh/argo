import ArgoEngine
@testable import ArgoUI
import Testing

/// What a roster row's `PlanBar` reads — the same Plan the Session's own pill shows, off the same
/// event hand-out the clock and the activity already walk (#1345).
@Suite("Session roster plan")
struct SessionRosterPlanTests {
    @Test
    func `a Session with a Plan carries it on the row`() throws {
        let row = try #require(rows(status: .running, events: [planEvent(
            ("Read the design", .completed),
            ("Wire the bar", .inProgress),
            ("Ship it", .pending),
        )]).first)

        #expect(row.plan?.count == 3)
        #expect(row.plan?.completed == 1)
    }

    @Test
    func `a Session that has never written a Plan draws no bar`() throws {
        let row = try #require(rows(status: .running, events: []).first)

        #expect(row.plan == nil)
    }

    @Test
    func `an emptied Plan is no Plan, the same absence as never writing one`() throws {
        let row = try #require(rows(status: .running, events: [planEvent()]).first)

        #expect(row.plan == nil)
    }

    @Test
    func `a fold sums no Plan, for the reason it sums no activity`() throws {
        // Four to-do lists do not add up to one (`cockpit-roster-row.md`, rule 9).
        let fold = try #require(SessionRosterProjection.rows(from: (0 ..< 3).map { index in
            RosterSessionFixture.session(
                id: "headless-\(index)",
                workspaceLocation: RosterSessionFixture.checkout,
                access: .external,
                entry: .headless,
                status: .running,
                events: [planEvent(("Do the thing", .inProgress))],
            )
        }).first { $0.fold != nil })

        #expect(fold.plan == nil)
    }

    private func rows(status: SessionStatus, events: [TranscriptEvent])
        -> [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: [
            RosterSessionFixture.session(id: "one", status: status, events: events),
        ])
    }

    private func planEvent(_ entries: (String, PlanEntryStatus)...) -> TranscriptEvent {
        .plan(Plan(entries: entries.map { PlanEntry(text: $0.0, status: $0.1) }))
    }
}
