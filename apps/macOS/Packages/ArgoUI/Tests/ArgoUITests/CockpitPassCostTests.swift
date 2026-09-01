@testable import ArgoUI
import Testing

/// What one pass of the shell's body COSTS, counted through the shell itself (`HostedCockpit`).
///
/// Both claims below held nothing before #997. Each fix was real and each was checked only where a
/// fixture had already reimplemented the wiring the fix is IN, so restoring the defect verbatim
/// left the whole suite green — 2 035 tests, 248 suites. Counts, never seconds: a count is exactly
/// the same idle and loaded (ADR-0028 Rule 8).
@Suite("Cockpit pass cost", .serialized)
@MainActor
struct CockpitPassCostTests {
    /// #957, said as the count it always was: the shell takes ONE reading a pass and hands it to
    /// every reader below.
    ///
    /// A construction is one `SessionsRoomReading(presentation:sessionID:)`, whether or not
    /// `SessionsRoomReadingCache` answered it out of what an earlier one left. That distinction is
    /// why this counter exists rather than the cache's: the second reading of a pass hits the
    /// cache, so it walks no stream and every derivation counter reads one while the shell builds
    /// two. What the second one still pays for is the selection lookup, the ask projection and the
    /// header's own walk, none of which a stamp remembers.
    @Test
    func `the shell builds one reading for every reading it takes`() {
        SessionsRoomReadingTally.forget()
        let shell = HostedCockpit()

        shell.visit(.tickets)
        shell.visit(.sessions)

        let tally = SessionsRoomReading.tally
        // The shell really read, and on more than one pass — or the equality below holds at
        // nothing.
        #expect(tally.taken > 1)
        #expect(tally.constructed == tally.taken)
    }

    /// #858's WIRING, which its mechanism cannot hold: every claim about what a store REMEMBERS is
    /// satisfied by a store made per pass, and a reader coming back to a reading still pays for
    /// every row in it, because each mount was bound to a different store.
    ///
    /// So the count is of DISTINCT stores the shell's tables were bound to over a room switch and
    /// back, which is the one number that tells the injection at `CockpitView.detail` from a fresh
    /// `FeedGeometries()` in the same place.
    @Test
    func `every table the shell mounts is bound to the one store it holds`() {
        FeedGeometriesReach.forget()
        let shell = HostedCockpit()

        shell.visit(.tickets)
        shell.visit(.sessions)

        // The store really reached a table, on more than one pass.
        #expect(FeedGeometries.reach.lookups > 1)
        #expect(FeedGeometries.reach.stores.count == 1)
    }
}
