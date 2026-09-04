import ArgoEngine
@testable import ArgoUI
import Testing

/// What the open Turn's start is when the record is awkward about it.
///
/// A file of its own because `openTurnStartMs` walks BACKWARDS from the tail — it is a fact about
/// the open Turn, and reading it used to cost a walk of every Turn that had already ended, once per
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

        #expect(row.clock == .seen("2m ago"))
    }

    /// A Turn nobody typed: the fan-out in #1299 ended its Turn to wait for its delegates, and the
    /// report that woke it is the only record of when the next Turn began. Without it the row on a
    /// working Session says how long ago it was last seen, which is the calm phrase a finished
    /// Session draws.
    @Test
    func `a Turn a report woke is clocked from the report`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
                .turnResumed(atMs: msAgo(90)),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(90)))
    }

    /// A wake INSIDE a Turn somebody typed changes nothing: the walk keeps going back and the
    /// prompt that opened the Turn overwrites it, so the clock still reads from what was asked.
    @Test
    func `a wake inside a typed Turn does not restart its clock`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnResumed(atMs: msAgo(90)),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(600)))
    }

    /// The boundary is where the walk STOPS, and every Turn behind it is a Turn already over —
    /// including one whose prompt is the only stamped thing in the record.
    @Test
    func `a record that ends on its boundary anchors nothing`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
            ],
        )).first)

        #expect(row.clock == .seen("2m ago"))
    }
}
