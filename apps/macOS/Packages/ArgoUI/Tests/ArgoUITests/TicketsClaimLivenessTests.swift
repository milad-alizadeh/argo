import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// Which Sessions are live enough to HOLD a ticket (#1118), and the invariant that keeps
/// `In progress` honest about them: the number on the rail is the number of rows under it.
///
/// `isLive` answers a different question — whether there is still something to open — and every
/// status but `ended` passes it. On a machine with a year of transcripts that let every old
/// external Session whose branch names a ticket go on claiming it, and the rail read 82 over a list
/// of one. `TicketsProgressCountTests` holds the readings; this suite holds the liveness.
@Suite("The claim's own liveness")
@MainActor
struct TicketsClaimLivenessTests {
    private static let now = Date().epochMs
    /// One millisecond older than the ceiling allows — the oldest a transcript can be and still be
    /// read as work in flight, plus one. Against the constant, never its literal.
    private static let stale = now - DelegationCeiling.reportWindowMs - 1

    private static func ticket(_ number: Int, closure: TicketClosure = .open) -> Ticket {
        Ticket(
            number: number, title: "Ticket \(number)", status: "open", closure: closure,
            blockedBy: [],
        )
    }

    private static func room(
        _ sessions: [CockpitPresentation.Session], over items: [Ticket],
    )
        -> TicketsRoomProjection.Room {
        TicketsLiveFixture.room(
            items: items, sessions: sessions, health: TicketsLiveFixture.answered,
            view: .inProgress,
        )
    }

    /// The Session the reader is looking at: `managed` IS a running process — one whose process is
    /// gone reads `orphaned` — so no age is consulted at all, and a Session sitting `idle`
    /// overnight is still where the reader left the work.
    @Test
    func `a managed Session claims its ticket however long it has been quiet`() {
        let managed = RosterSessionFixture.session(
            id: "managed", access: .managed, status: .idle, lastSeenAtMs: Self.stale,
            ticket: .linked(.init(number: 812)),
        )

        let room = Self.room([managed], over: [Self.ticket(812)])

        #expect(room.view(.inProgress)?.count == 1)
    }

    /// The one that made the number wrong. Nothing about a `stopped` or `unknown` external Session
    /// says it finished — which is exactly why `isLive` keeps it — but a record that has not moved
    /// since yesterday is not somebody working on a ticket now.
    @Test(arguments: [SessionStatus.stopped, .unknown, .idle, .running])
    func `an external Session past the ceiling claims nothing`(status: SessionStatus) {
        let external = RosterSessionFixture.session(
            id: "external", access: .external, status: status, lastSeenAtMs: Self.stale,
            ticket: .linked(.init(number: 812)),
        )

        let room = Self.room([external], over: [Self.ticket(812)])

        #expect(room.view(.inProgress)?.count == .zero)
        // And it is not counted as a Session the join could not PLACE either: it named a ticket
        // perfectly well, and it is simply not in the set the count is over.
        #expect(room.view(.inProgress)?.unplaced == .zero)
    }

    /// The other side of the same rule: an external Session whose transcript moved inside the
    /// ceiling is somebody's live run, and it holds its ticket like any other.
    @Test
    func `an external Session inside the ceiling claims its ticket`() {
        let external = RosterSessionFixture.session(
            id: "external", access: .external, status: .running, lastSeenAtMs: Self.now,
            ticket: .linked(.init(number: 812)),
        )

        let room = Self.room([external], over: [Self.ticket(812)])

        #expect(room.view(.inProgress)?.count == 1)
    }

    /// An orphaned Session has lost the process that made `managed` a DIRECT fact
    /// (`CONTEXT.md` L2 · orphaned), so it is judged on its record like an external one.
    @Test
    func `an orphaned Session is judged on its record, not on its provenance`() {
        let orphaned = RosterSessionFixture.session(
            id: "orphaned", access: .orphaned, status: .idle, lastSeenAtMs: Self.stale,
            ticket: .linked(.init(number: 812)),
        )

        let room = Self.room([orphaned], over: [Self.ticket(812)])

        #expect(room.view(.inProgress)?.count == .zero)
    }

    /// The ceiling's own nil rule INVERTED, which is the one place the two readings part. A
    /// delegation the record never dated keeps its running claim, because taking it would quiet a
    /// live fan-out on a host that stamps nothing. A ticket claim is the other way round: the rule
    /// is "moved inside the ceiling", and no moment at all is not evidence that anything moved.
    @Test
    func `an external Session the record never dated claims nothing`() {
        let undated = RosterSessionFixture.session(
            id: "undated", access: .external, status: .running, lastSeenAtMs: nil,
            ticket: .linked(.init(number: 812)),
        )

        let room = Self.room([undated], over: [Self.ticket(812)])

        #expect(room.view(.inProgress)?.count == .zero)
    }

    /// The invariant #1074 exists for, over the ground this ticket changed: a claim on a CLOSED
    /// ticket and a claim from a Session past the ceiling both leave the rail and the rows saying
    /// the same number, because both are read off one set.
    @Test
    func `the count is the number of rows the list draws`() {
        let live = RosterSessionFixture.session(
            id: "live", ticket: .linked(.init(number: 812)),
        )
        let onClosed = RosterSessionFixture.session(
            id: "closed", ticket: .linked(.init(number: 700)),
        )
        let pastCeiling = RosterSessionFixture.session(
            id: "past", access: .external, status: .stopped, lastSeenAtMs: Self.stale,
            ticket: .linked(.init(number: 900)),
        )

        let room = Self.room([live, onClosed, pastCeiling], over: [
            Self.ticket(812), Self.ticket(900), Self.ticket(700, closure: .resolved),
        ])

        let rows = TicketsRoomProjection.drawn(room.backlog, shut: [])
        #expect(room.view(.inProgress)?.count == rows.count)
        #expect(rows.map(\.id) == [812])
    }
}
