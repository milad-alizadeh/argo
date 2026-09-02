@testable import ArgoUI
import Testing

/// What a measured height is filed UNDER, and what makes the store give one up.
///
/// `FeedGeometryTests` is the same store asked what a room switch costs. This is the store's own
/// mechanics: the whole of what a `Ground` is a fact about, that `==` and never the hash is what
/// answers with it, and the ceiling that keeps a reading's orphaned heights from outliving it.
@Suite("Feed geometry store")
@MainActor
struct FeedGeometryStoreTests {
    /// Longer than any ceiling these cases state, so eviction is what the case asked for rather
    /// than the store running out of room.
    private static let rows = (0 ..< 20).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    /// The one thing in a ground that is about neither the row nor the row above it. A chip is a
    /// fact about the whole Turn — the last message of one draws it and every message before it
    /// does not (`FeedCopy.drawsChip(of:at:)`) — so two rows saying the same words under the same
    /// row stand at different heights. Nothing else in a ground could tell them apart, and before
    /// the chip joined it this was `surrenderMovedChip`, naming a row by its index.
    @Test
    func `the Turn's copy chip is part of what a height is true of`() {
        let geometry = FeedGeometry()
        let said = FeedRow.Content.message("The very same words, said twice in one reading.")
        let asked = FeedRow.Content.prompt(text: "Ask once.", shots: [])
        // Row 1 has another message under it inside its own Turn, so the Turn's chip is not on it.
        // Row 4 says the same words under the same kind of row and is the last message there is.
        let model = FeedTableFixture.model(showing: [asked, said, said, asked, said]
            .enumerated().map { FeedRow(id: $0.offset, content: $0.element) })
        #expect(Self.ground(at: 1, of: model).drawsChip == false)
        #expect(Self.ground(at: 4, of: model).drawsChip)

        geometry.record(40, under: Self.ground(at: 1, of: model))

        #expect(geometry.height(under: Self.ground(at: 4, of: model)) == nil)
    }

    /// And that it is `==` over the whole ground that answers, never the hash. `Ground.hash(into:)`
    /// spreads a row on its length and both its ends, which is deliberately lossy — two rows can
    /// land in one bucket — so the case that matters is two rows a spread CANNOT tell apart. They
    /// must still answer separately, or the lossiness is a wrong height rather than a comparison.
    @Test
    func `two rows one hash cannot tell apart still answer separately`() {
        let geometry = FeedGeometry()
        let head = "Same at the front, "
        let foot = ", and the same at the back."
        let asked = FeedRow.Content.prompt(text: "Ask once.", shots: [])
        // Each under a prompt of its own, so the two grounds differ in their ROW and in nothing
        // else — a spread reads the same length and the same eight bytes at either end of both.
        let said = ["one line of the middle", "ONE LINE OF THE MIDDLE"]
            .map { FeedRow.Content.message(head + $0 + foot) }
        let model = FeedTableFixture.model(showing: [asked, said[0], asked, said[1]]
            .enumerated().map { FeedRow(id: $0.offset, content: $0.element) })
        // The premise: the two really are one bucket, or the case below proves nothing.
        #expect(Self.bucket(of: Self.ground(at: 1, of: model))
            == Self.bucket(of: Self.ground(at: 3, of: model)))

        geometry.record(40, under: Self.ground(at: 1, of: model))

        #expect(geometry.height(under: Self.ground(at: 3, of: model)) == nil)
    }

    /// A store nothing has told how long its reading is holds what it is given. The ceiling is a
    /// fact about a reading, and `FeedTableCoordinator.apply` states it before a row is ever
    /// measured — a store that read an unstated ceiling as ZERO would answer nothing, for ever,
    /// with every claim about a kept height still passing.
    @Test
    func `a store never told how long its reading is holds what it is given`() {
        let geometry = FeedGeometry()
        let model = FeedTableFixture.model(showing: Self.rows)

        geometry.record(120, under: Self.ground(at: 1, of: model))

        #expect(geometry.height(under: Self.ground(at: 1, of: model)) == 120)
    }

    /// What "least recently ASKED-FOR" buys, which is why the ceiling can have headroom at all: a
    /// height nobody asks for is the one that leaves. Stamped on a HIT and not only on a write, or
    /// the store is insertion order wearing an LRU's name — and the entry a re-write orphaned,
    /// which is the whole reason there is a ceiling, is the one nobody asks for.
    @Test
    func `the height nobody has asked for is the one eviction takes`() {
        let geometry = FeedGeometry()
        let model = FeedTableFixture.model(showing: Self.rows)
        geometry.hold(rows: 3)
        for row in 1 ... 5 {
            geometry.record(40, under: Self.ground(at: row, of: model))
        }
        // Row 1 is the OLDEST entry and the only one asked for since.
        #expect(geometry.height(under: Self.ground(at: 1, of: model)) == 40)

        geometry.record(40, under: Self.ground(at: 6, of: model))
        geometry.record(40, under: Self.ground(at: 7, of: model))

        #expect(geometry.height(under: Self.ground(at: 1, of: model)) == 40)
        #expect(geometry.height(under: Self.ground(at: 2, of: model)) == nil)
    }

    /// Which bucket a ground would fall in, which is all a hash decides.
    private static func bucket(of ground: FeedGeometry.Ground) -> Int {
        var hasher = Hasher()
        ground.hash(into: &hasher)
        return hasher.finalize()
    }

    private static func ground(at index: Int, of model: FeedTableModel) -> FeedGeometry.Ground {
        FeedGeometry.Ground(at: index, of: model)
    }
}
