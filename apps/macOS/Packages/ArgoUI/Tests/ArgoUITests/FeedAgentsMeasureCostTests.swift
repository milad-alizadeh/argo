@testable import ArgoUI
import Testing

/// ONE walk of the reading (#1279, rule 4). Behind one chip's meter is its child's whole file, and
/// the rail asks on every pass — a derivation per chip per frame is #858's cost one level down.
@Suite("Feed agents measure cost")
@MainActor
struct FeedAgentsMeasureCostTests {
    private typealias Fixture = FeedAgentsMeterFixture

    /// The deck and the toolbar ask the same reader in the same pass; the file is walked once.
    @Test
    func `the rail measures a child once, however many times it asks`() {
        SessionsRoomReadingCache.forget()
        let room = Fixture.room(of: .ended)
        let reader = FeedAgentReader(events: [Fixture.child: Fixture.ran]).stamped(room.stamp)

        let deck = reader.agents(in: room.feed)
        let toolbar = reader.agents(in: room.feed)

        #expect(deck == toolbar)
        #expect(SessionsRoomReadingCache.cost.measures == 1)
    }

    /// The memo is keyed on the child's own GROWTH STAMP, so a Subagent Argo has watched write
    /// since is measured again. Keyed on the room's stamp alone it would freeze — that stamp does
    /// not move for a child's bytes.
    @Test
    func `a child argo has watched write since is measured again`() {
        SessionsRoomReadingCache.forget()
        let room = Fixture.room(of: .ended)
        let opening = FeedAgentReader(events: [Fixture.child: Array(Fixture.ran.prefix(2))])
        let grown = FeedAgentReader(
            events: [Fixture.child: Fixture.ran],
            writing: [Fixture.child],
        )

        let first = opening.stamped(room.stamp).agents(in: room.feed)
        let second = grown.stamped(room.stamp).agents(in: room.feed)

        #expect(first.first?.durationMs == nil)
        #expect(second.first?.durationMs == 12000)
        #expect(SessionsRoomReadingCache.cost.measures == 2)
    }

    /// The other side of that key, and the reason it is affordable: a child Argo has NOT watched
    /// write is not measured again, whatever else the pass rebuilt. `lastGrewAtMs` is unset only
    /// until a batch lands after the backfill, so nothing seen means a reading that is not moving.
    @Test
    func `a child nothing has watched write is measured once`() {
        SessionsRoomReadingCache.forget()
        let room = Fixture.room(of: .ended)
        let reader = FeedAgentReader(events: [Fixture.child: Fixture.ran])

        _ = reader.stamped(room.stamp).agents(in: room.feed)
        _ = reader.stamped(room.stamp).agents(in: room.feed)

        #expect(SessionsRoomReadingCache.cost.measures == 1)
    }

    /// The SCOPE key asks the UNTOLD list, and that is what keeps the warm pass free.
    ///
    /// `reading(of:under:)` resolves which Agent a scope names on every call, memoised rows or not.
    /// The second reader here has watched the child write since — the growth stamp has moved, so a
    /// told list would be measured again — and the scoped rows still cost nothing, because
    /// resolving a scope is a lookup by position and a Subagent ID.
    @Test
    func `resolving a scope measures nothing, even for a child that has written since`() {
        SessionsRoomReadingCache.forget()
        let room = Fixture.room(of: .ended)
        let opened = FeedAgentReader(events: [Fixture.child: Fixture.ran]).stamped(room.stamp)
        let again = FeedAgentReader(
            events: [Fixture.child: Fixture.ran],
            writing: [Fixture.child],
        ).stamped(room.stamp)

        _ = opened.reading(of: room.feed, under: .subagent(0))
        let cold = SessionsRoomReadingCache.cost.measures
        _ = again.reading(of: room.feed, under: .subagent(0))

        #expect(cold == 1)
        #expect(SessionsRoomReadingCache.cost.measures == cold)
    }
}
