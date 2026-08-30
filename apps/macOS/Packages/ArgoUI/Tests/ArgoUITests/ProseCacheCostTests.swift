import AppKit
@testable import ArgoUI
import Testing

/// What the reading stores actually hold while a whole-document walk crosses them (ADR-0028
/// Rule 4).
///
/// The lane's geometry is one such walk — `FeedTableCoordinator.reading()` asks
/// `ProseReading.structure(of:)` for every prose row — and a store emptied whole at a literal under
/// the length of that walk hits nothing at all: it empties part-way through the reading and arrives
/// back at row 0 with the head of the pass already gone. So the claim is a HIT RATE over a document
/// past the old 512 literal, cold on its first pass, and not a duration.
@MainActor
@Suite("Prose cache cost")
struct ProseCacheCostTests {
    private static let column = CGSize(width: 620, height: 800)

    /// Past the 512 the store used to empty itself at, and past it far enough that emptying would
    /// happen twice inside one pass. Every text distinct, and distinct from every other suite's, so
    /// the first pass below is cold without a suite reaching into the static stores to empty them.
    private static let rows = (0 ..< 900).map { at in
        FeedRow(
            id: at,
            content: .message("## Cache turn \(at)\n\n" + MinimapText.paragraph),
        )
    }

    /// The cliff, as the property it broke. Cold, the walk reads every distinct text once; warm, it
    /// reads none of them — which is only true of a store held to the DOCUMENT rather than to a
    /// literal a 900-row reading walks past.
    @Test
    func `a whole-document walk past the old ceiling hits everything on its second pass`() {
        let handle = FeedTableHandle()
        let table = FeedTableFixture.laidOut(Self.rows, in: Self.column, through: handle)
        let opening = ProseReading.structureCost

        // Cold is a single sample, because a first pass over an empty store IS the measurement.
        let coldCPU = cpuSeconds { _ = table.reading() }
        let cold = ProseReading.structureCost
        let warmCPU = leastCPUSeconds { _ = table.reading() }
        let warm = ProseReading.structureCost

        // The cold pass really is one read per row: a walk that emptied itself mid-pass would read
        // more than the document has rows.
        #expect(cold.misses - opening.misses == Self.rows.count)
        // And the warm pass reads nothing at all — the rate the walk achieved rather than a
        // threshold under it, because the whole defect was a rate of zero.
        #expect(warm.hitRate(since: cold) == 1)
        // What that rate is worth, said as a ratio against the walk that earned it rather than as
        // seconds (ADR-0028 Rule 7). Measured on an M-series Mac in debug over the 900 rows above:
        // 350 ms cold, 2.4 ms warm — a 145th of it — against a store emptied at 512, which read
        // every row again for 8.2 ms and a hit rate of zero.
        #expect(warmCPU < coldCPU / 40)
    }

    /// The bound the hit rate is bought with. A reading longer than the cap is held to the cap, so
    /// a session read all day still cannot grow the store without end — the oldest entries go, and
    /// what the walk just read stays.
    @Test
    func `a reading longer than the cap is held to the cap, oldest first`() {
        var cache = ProseCache<String>(ceiling: 2, cap: 4)
        var reads = 0
        let read = { (text: String) in
            reads += 1
            return text
        }

        cache.hold(atLeast: 400)
        #expect(cache.ceiling == 4)
        for line in 0 ..< 6 {
            _ = cache.reading(of: "line \(line)", read: read)
        }
        let held = reads

        // The oldest is gone and the newest is still there, which is the whole difference from
        // emptying the store: a walk keeps what it has just read.
        _ = cache.reading(of: "line 0", read: read)
        _ = cache.reading(of: "line 5", read: read)

        #expect(reads == held + 1)
    }

    /// The ceiling only ever rises, and never past the cap. Two readings share these stores, so a
    /// short one following a long one must not evict what the long one is still walking.
    @Test
    func `the ceiling rises to the document and never falls back`() {
        var cache = ProseCache<String>(ceiling: 8, cap: 64)

        cache.hold(atLeast: 32)
        cache.hold(atLeast: 4)
        #expect(cache.ceiling == 32)

        cache.hold(atLeast: 4000)
        #expect(cache.ceiling == 64)
    }
}
