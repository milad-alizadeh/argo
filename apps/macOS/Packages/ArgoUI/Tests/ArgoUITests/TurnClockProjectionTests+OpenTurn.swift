import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the dot's pulse paces off when the record is awkward about it — `row.turnStartedAt`,
/// kept apart from the roster clock's own Session-wide reading since #1330. A file of its own
/// because `openTurnStartedAtMs` walks BACKWARDS from the tail — it is a fact about the OPEN
/// Turn, and reading it used to cost a walk of every Turn that had already ended, once per
/// running Session, on every pass of the shell's body. The forward walk carried a flag; the
/// backwards one carries the last write. These are the inputs where the two could have parted.
extension TurnClockProjectionTests {
    /// The case a careless backwards walk gets wrong: the Turn's own first prompt carries no stamp
    /// and a steer inside the same Turn does. Walking back from the tail the steer is met first,
    /// and the unstamped prompt overwrites it — so the answer is still the FIRST prompt of the
    /// Turn, and still degrade-down rather than the steer's time.
    @Test
    func `an unstamped Turn stays unanchored however many stamped steers follow it`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: nil),
                .prompt(text: "also check the tests", images: [], atMs: msAgo(30)),
            ],
        )).first)

        #expect(row.turnStartedAt == nil)
    }

    /// A Turn nobody typed: the fan-out in #1299 ended its Turn to wait for its delegates, and the
    /// report that woke it is the only record of when the next Turn began. The dot's pulse paces
    /// off that report, not off the Session's own first prompt however much earlier that was.
    @Test
    func `a Turn a report woke paces the pulse from the report`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
                .turnResumed(atMs: msAgo(90)),
            ],
        )).first)

        #expect(row.turnStartedAt == Date(epochMs: msAgo(90)))
    }

    /// A wake INSIDE a Turn somebody typed changes nothing: the walk keeps going back and the
    /// prompt that opened the Turn overwrites it, so the pulse still paces off what was asked.
    @Test
    func `a wake inside a typed Turn does not restart the pulse`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnResumed(atMs: msAgo(90)),
            ],
        )).first)

        #expect(row.turnStartedAt == Date(epochMs: msAgo(600)))
    }

    /// The boundary is where the pulse's OWN walk stops, and every Turn behind it is a Turn
    /// already over — including one whose prompt is the only stamped thing in the record. The
    /// roster clock does not share this bound any more (#1330): it counts from that same prompt.
    @Test
    func `a record that ends on its boundary paces no pulse, but still clocks the Session`()
        throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
            ],
        )).first)

        #expect(row.turnStartedAt == nil)
        #expect(row.clock == .session(startedAtMs: msAgo(600)))
    }
}
