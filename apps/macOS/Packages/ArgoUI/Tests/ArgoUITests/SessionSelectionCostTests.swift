import ArgoFixtures
@testable import ArgoUI
import Testing

/// What the pass BETWEEN the mouse-down and the frame that paints the selected ground costs
/// (ADR-0028 Rule 1 and Rule 3).
///
/// The user's complaint, in his own words: *"clicking and then hanging for a split second is not
/// acceptable."* `CockpitView.body` took the whole Sessions reading for whatever `navigation
/// .session` had just become, so the frame the click asked for could not commit until a walk of the
/// new Session's event stream, its plan projection and its header walk had all finished — three
/// walks that grow with the transcript, in front of a highlight that depends on none of them. The
/// row lit up when the reading was done rather than when the row was clicked.
///
/// COUNTS, and never the seconds (ADR-0028 Rule 8): a count reads the same idle and loaded, which
/// is the whole reason a claim like this can be gated on a laptop with five other agents on it.
/// The count here is the one `CockpitPresentationCostTests` uses — `HeldEvents.reads`, the tally on
/// the only accessor that reaches a Session's events — so anything that walks a stream on the click
/// pass has to move it, and a pass that reads nothing cannot.
///
/// **Zero at a short transcript and zero at an eightfold one.** The two sizes are Rule 3's, and
/// what they carry is that the READING is off this pass at either length — exact, rather than
/// bounded by a ratio, because the honest number for it is none at all.
///
/// **It is not a claim that the pass is cheap, and must not be read as one.** The count is of
/// stream HAND-OUTS (`HeldEvents`), so it moves when new code reaches for a transcript and stays
/// put when existing code walks one harder. What is left on the pass is named at
/// `PerfBudgets.selectionPassReads`, and one of the three — `TouchedFiles.touched` — is still
/// linear in the transcript: the figures below read 8.25 ms at 728 events against 12.30 ms at
/// 5 824, which is a pass that still grows. That residue is measured, named and not gated.
///
/// The other half is `the reading really does land a beat later`, and it matters more than the
/// zeros: a shell that had simply stopped reading would pass every gate above.
///
/// **The seconds ride along here and BIND nothing** (ADR-0028 Rule 8). Through this same hosted
/// shell, the click pass over a two-Session roster cost **91.56 ms before and 8.25 ms after** at
/// 728 events, and **97.39 ms before and 12.30 ms after** at 5 824 — a fold of 11.10 and 7.92 ·
/// M4 Pro · release · least of 9 interleaved; debug reads 109.14 → 9.31 and 150.28 → 15.87.
/// `SessionSelectionFigureRecording` is where they come
/// from and is what re-records them; its two arms are the shipped shell either side of
/// `DrawnSession.hasDrawn`, warmed by the same number of layout passes so the deferral is the only
/// difference between them. They are still a quotient of two thread-CPU readings, so they are a
/// figure and the counts above are the gate.
///
/// **Most of what moved is not the transcript.** The before arm barely grows with it — 91.56 ms at
/// 728 events against 97.39 ms at eight times that — because the projection itself is small: a
/// cold `SessionsRoomReading` over 4 800 records of 13 KB each, a 60 MB transcript, costs 3 ms.
/// What the click was waiting on is the shell's whole body pass and the feed table's mount, which
/// are roughly fixed and were roughly 90 ms of it. That is the finding, and it is why the fix is a
/// deferral rather than a faster projection: the pass could not be made cheap, only moved.
///
/// **At the size of a real record it is the mount that grows.** Over a two-Session roster of 4 800
/// records at 13 KB each — 59.5 MB, the shape of the largest Session on this machine's registry —
/// the click pass reads **381 ms before and 21 ms after**, so 360 ms moved · M4 Pro · debug · least
/// of 3. That 360 ms is what the catch-up pass costs, and it is the figure
/// `ArgoMotion.unreadDelay` is judged against: an idle switch at that size fills the deck inside
/// the delay and says nothing, which is what the delay is for.
@Suite("Session selection cost", .serialized)
@MainActor
struct SessionSelectionCostTests {
    /// The gate, and the whole of the ask: the frame a click asks for does not wait on the reading
    /// of what was clicked.
    @Test(arguments: Self.scales)
    func `the pass that paints a fresh selection takes no reading`(scale: Int) async {
        let roster = Self.roster(scale: scale)
        let shell = await Self.opened(on: roster)
        SessionsRoomReadingTally.forget()
        SessionsRoomReadingCache.forget()
        // Cleared HERE and not at the open: the open lays out five times, so a probe forgotten
        // before it reads a number the click did not put there — a liveness check that would pass
        // over a `select` which laid nothing out at all.
        FeedGeometriesReach.forget()

        shell.select(Self.other)

        // The pass really ran — a shell that laid nothing out would read zero for the wrong reason.
        #expect(FeedGeometries.reach.lookups > 0)
        #expect(SessionsRoomReading.tally.taken == 0)
        #expect(SessionsRoomReadingCache.cost.bodies == 0)
    }

    /// Rule 3, over the reads the pass still costs. What is left on it is a fixed number of walks
    /// that are not the reading, and the two sizes are what say so: eight times the transcript is
    /// the same click.
    @Test(arguments: Self.scales)
    func `the click pass costs the same reads at eight times the transcript`(scale: Int) async {
        let roster = Self.roster(scale: scale)
        let shell = await Self.opened(on: roster)
        let before = Self.reads(roster)

        shell.select(Self.other)

        #expect(Self.reads(roster) - before == PerfBudgets.selectionPassReads)
    }

    /// What the zeros above would be worthless without: the reading is DEFERRED and not dropped.
    /// One turn of the run loop later the shell has caught up, and catching up is what costs the
    /// walks — which is also the proof that the counters those gates read are live.
    @Test
    func `the reading really does land a beat later`() async {
        let roster = Self.roster(scale: 1)
        let shell = await Self.opened(on: roster)
        SessionsRoomReadingCache.forget()

        shell.select(Self.other)
        let onTheClick = SessionsRoomReadingCache.cost.bodies
        await shell.settle()

        #expect(onTheClick == 0)
        #expect(SessionsRoomReadingCache.cost.bodies > 0)
    }

    /// The deferral is per SWITCH and not per pass, which is the line between a click that lands
    /// fast and a deck that blinks: made per pass, a Session whose transcript grew under the reader
    /// would blink through `FeedVacancy.unread` on every append it received.
    ///
    /// A room round-trip is what stands in for that append — this shell holds one presentation for
    /// its life, so a grown one is a different shell. What both have in common is the thing under
    /// test: a pass over a Session the shell has ALREADY drawn, with no selection change in it.
    @Test
    func `a Session already drawn is read on the pass that asks for it`() async {
        let roster = Self.roster(scale: 1)
        let shell = await Self.opened(on: roster)
        shell.select(Self.other)
        await shell.settle()

        // Out of the room and back, which is a pass over the SAME Session: nothing about the
        // selection moved, so a shell that had made the deferral per pass would take no reading
        // here either.
        shell.visit(.tickets)
        SessionsRoomReadingTally.forget()
        shell.visit(.sessions)

        #expect(SessionsRoomReading.tally.taken > 0)
    }

    /// The two sizes Rule 3 asks a cost case to carry: the long transcript, and eight of it. A
    /// zero at both is what says the cost does not follow the length. `nonisolated` because the
    /// `@Test` macro reads its arguments outside the actor.
    nonisolated static let scales = [1, 8]

    /// The row the click lands on. Never the row the shell opened on: switching to the Session
    /// already drawn is not a switch, and would pass the gate by doing nothing.
    private static let other = "two"

    /// A shell opened on `one` and settled there, so the click under test is the FIRST reading of
    /// `two` — the cold case, which is the one the complaint is about.
    private static func opened(on roster: CockpitPresentation) async -> HostedCockpit {
        SessionsRoomReadingCache.forget()
        SessionsRoomReadingTally.forget()
        let shell = HostedCockpit(showing: roster)
        // Settled, or the shell is still on its FIRST pass, which reads inline by design — see
        // `DrawnSession.hasDrawn`. A click measured there would be measuring the launch.
        await shell.settle()
        return shell
    }

    /// Every stream in the roster, summed: a pass that walks any ONE of them is a read.
    private static func reads(_ roster: CockpitPresentation) -> Int {
        roster.sessions.map(\.transcript.stream.reads.count).reduce(0, +)
    }

    /// Two Sessions of `scale` times the long transcript. Two, because one cannot be switched
    /// between.
    private static func roster(scale: Int) -> CockpitPresentation {
        HostedCockpit.presentation(
            of: ["one", other],
            events: Array(repeating: TranscriptFixtures.longTranscript, count: scale)
                .flatMap(\.self),
        )
    }
}
