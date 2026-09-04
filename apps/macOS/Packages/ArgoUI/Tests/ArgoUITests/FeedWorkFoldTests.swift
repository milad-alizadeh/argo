import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// A Turn's work folded into one card per stretch (#1172).
///
/// Every case runs over `TranscriptFixtures.denseTurn` or over a stream written here with the same
/// shape: a call, then the agent's sentence about it, then the next call. `foldedLooking` is not a
/// specimen for any of this — its calls arrive in unbroken runs, so an adjacency rule folds it
/// identically and a case written over it would pass with the per-Turn rule deleted.
@Suite("Feed work fold")
struct FeedWorkFoldTests {
    private static let rows = FeedProjection.rows(from: TranscriptFixtures.denseTurn)

    /// The fixture's two Turns apart, split at the stop reason that closes the first.
    private static let dense = Array(rows.prefix { !$0.kind.endsTurn })
    private static let sparse = Array(rows.drop { !$0.kind.endsTurn }.dropFirst())

    /// The rule itself: the calls are never adjacent, and they still come back as one card.
    @Test
    func `every call of a stretch in a Turn folds into one card, across the narration`() {
        let cards = FeedFixture.work(in: Self.rows)

        #expect(cards.map(\.label) == ["Created 3 · Edited 3 · Deleted 1", "Ran 4"])
        #expect(cards.map(\.calls.count) == [7, 4])
    }

    /// The card lists the N calls it stands for, which is what expanding it draws.
    @Test
    func `an expanded card lists every call it folded`() throws {
        let card = try #require(FeedFixture.work(in: Self.rows).first)

        #expect(card.steps.count == card.calls.count)
        #expect(card.steps.map(\.caption) == [
            "FeedWork.swift", "FeedWorkFold.swift", "FeedWorkFold.swift", "FeedShapeHeight.swift",
            "FeedRowShape.swift", "FeedLegacyFold.swift", "FeedFoldLine.swift",
        ])
    }

    /// A fold of one saves no row and costs the name of the only call it stood for.
    @Test
    func `a Turn with one call of a stretch does not fold that stretch`() {
        #expect(FeedFixture.work(in: Self.sparse).isEmpty)
        #expect(Self.sparse.flatMap(\.content.calls).map(\.subject.captioned) == [
            "FeedShapeHeightTests+Rows.swift", "swift test --filter FeedShapeHeight",
        ])
    }

    /// The one skill the dense Turn invoked is a stretch of one too, inside a Turn that folded two
    /// other stretches — so the rule is per stretch and not per Turn.
    @Test
    func `a lone call keeps its row inside a Turn that folded around it`() {
        #expect(Self.dense.compactMap { row -> String? in
            guard case let .call(call) = row.content else { return nil }
            return call.subject.captioned
        } == ["design-to-code"])
    }

    /// A card whose stretch contains a failure states the count in its header, so a reader who
    /// never opens it is not told the work went fine.
    @Test
    func `a card counts its failures in the header`() throws {
        let commands = try #require(FeedFixture.work(in: Self.rows).last)

        #expect(commands.failures == 1)
        #expect(commands.ending == .failed)
        #expect(commands.spoken.contains("1 failed"))
    }

    /// And the failed step is marked in the list, so opening the card says WHICH one.
    @Test
    func `the failed step is marked in the card's list`() throws {
        let commands = try #require(FeedFixture.work(in: Self.rows).last)

        #expect(commands.steps.map(\.hasFailed) == [false, true, false, false])
    }

    /// A card that folded no failure says nothing about failures at all.
    @Test
    func `a card that went through counts nothing`() throws {
        let mutations = try #require(FeedFixture.work(in: Self.rows).first)

        #expect(mutations.failures == 0)
        #expect(mutations.ending == .succeeded)
        #expect(!mutations.spoken.contains("failed"))
    }

    /// The grouping is kind-agnostic and the caption is kind-aware: an edit beside a write beside a
    /// delete is one piece of the Turn's work, and the line still names all three.
    @Test
    func `a mutation of one kind folds with a mutation of another`() throws {
        let mutations = try #require(FeedFixture.work(in: Self.rows).first)

        #expect(Set(mutations.calls.map(\.kind)) == [.create, .edit, .delete])
    }

    /// What the whole stretch changed, summed off the patches the record carried.
    @Test
    func `a card of mutations carries the stretch's whole diffstat`() throws {
        let mutations = try #require(FeedFixture.work(in: Self.rows).first)
        let churn = try #require(mutations.churn)
        let added = mutations.calls.compactMap(\.churn).reduce(0) { $0 + $1.added }

        #expect(churn.added == added)
        #expect(added > 0)
    }

    /// A card of commands changed nothing, so it draws no diffstat rather than `+0 −0`.
    @Test
    func `a card of commands carries no diffstat`() throws {
        #expect(try #require(FeedFixture.work(in: Self.rows).last).churn == nil)
    }

    /// The card stands where the work started, so the reading keeps the Turn's own order.
    @Test
    func `the card takes the place of the first call it folded`() throws {
        let first = try #require(Self.rows.firstIndex { $0.content.calls.count > 1 })
        let before = Self.rows[..<first].flatMap(\.content.calls)

        #expect(before.map(\.subject.captioned) == ["design-to-code"])
    }
}
