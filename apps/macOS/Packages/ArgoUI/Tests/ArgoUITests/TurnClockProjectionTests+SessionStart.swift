import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Session's start is when the record is awkward about it (#1330 corrected this from
/// the open Turn's start, which reset at every Turn boundary, to the resume-chain's own first
/// prompt).
extension TurnClockProjectionTests {
    /// The Session's own first prompt carries no stamp and a steer later in the same Turn does —
    /// the answer is still degrade-down rather than the steer's time, whichever prompt a naive
    /// scan meets first.
    @Test
    func `an unstamped first prompt stays unanchored however many stamped steers follow it`(
    ) throws {
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
    /// report that woke it is the only record of when the next Turn began. Where that wake is the
    /// resume-chain's OWN first record — nothing precedes it — it is the Session's start too.
    @Test
    func `a Session a report woke is clocked from the report when nothing precedes it`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .turnResumed(atMs: msAgo(90)),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(90)))
    }

    /// A wake that follows an earlier, typed Turn changes nothing: the Session's start is still
    /// its first prompt, unbroken by the boundary in between (#1330).
    @Test
    func `a wake after an earlier Turn does not restart the clock`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
                .turnResumed(atMs: msAgo(90)),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(600)))
    }

    /// A boundary with nothing typed after it is not where the total stops either: the Session is
    /// still running, and its total still counts from the first prompt straight through.
    @Test
    func `a record that ends on a Turn boundary still totals from the first prompt`() throws {
        let row = try #require(rows(session(
            status: .running,
            lastSeenAtMs: msAgo(120),
            events: [
                .prompt(text: "go", images: [], atMs: msAgo(600)),
                .turnEnded(.endTurn),
            ],
        )).first)

        #expect(row.clock == .turn(startedAtMs: msAgo(600)))
    }
}
