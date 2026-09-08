import ArgoEngine
@testable import ArgoUI
import Testing

/// The window between the record answering a Turn and the status turning, and where a Turn typed
/// inside it goes (#1636).
///
/// Two Turns sent while a Session was busy arrive as ONE prompt and one bubble, their texts run
/// together with no space between them. Neither reading the composer asks can see the CLI is busy:
/// `hasUnansweredTurn` is spent by the record growing by ANYTHING, and `recordIdentity` leads
/// every message-bearing record, ahead of the `prompt` that opens the Turn — so it is spent a fold
/// before the status word turns, and the second Turn takes the straight-send branch into a PTY the
/// CLI is busy on.
///
/// What closes it is the claim the composer already makes about its own act: a Turn it PUT that
/// the record has yet to show running (#1337), which `ComposerRelease` reads and
/// `SessionComposer.holdsTurn` now reads too. Its own suite because the claim is about where a
/// Turn GOES, which is neither the release's question nor the put wait's.
@Suite("Composer busy window")
@MainActor
struct ComposerBusyWindowTests {
    /// The reported defect, at the boundary arm: a queued follow-up is released, and the Turn the
    /// reader types next — before the record has shown that release running — must queue behind it
    /// rather than go down the same busy PTY.
    @Test
    func `a Turn typed after a release, before the record shows it, is queued`() throws {
        let log = Log()
        // Typed while the Turn ran, so it waits; the boundary then puts it.
        type("Open the PR.", in: log, at: .running)
        composer(log, at: .idle).turnEnded()
        try #require(log.acts == ["send Open the PR."])

        // The window: every Session-side reading says at rest, and Argo's own put says otherwise.
        type("And tag it.", in: log, at: .idle)

        #expect(log.acts == ["send Open the PR."])
        #expect(log.draft.queued.map(\.text) == ["And tag it."])
        #expect(log.draft.text.isEmpty)
    }

    /// The same window on the straight-send arm, which is the one `hasUnansweredTurn` was the only
    /// guard for: the reader sends at a Session at rest, and sends again before the record has
    /// caught up. A count spent by a `.recordIdentity` leaves that guard reading `false` over a
    /// CLI that has the first Turn and is working on it.
    @Test
    func `a Turn typed after a straight send, before the record shows it, is queued`() throws {
        let log = Log()
        type("Open the PR.", in: log, at: .idle)
        try #require(log.acts == ["send Open the PR."])

        type("And tag it.", in: log, at: .idle)

        #expect(log.acts == ["send Open the PR."])
        #expect(log.draft.queued.map(\.text) == ["And tag it."])
    }

    /// …and the queue it went onto is one the release still comes for, which is what keeps this
    /// from being its own void: the claim is spent by a Turn read running, and the boundary after
    /// that one carries the follow-up.
    @Test
    func `the Turn held back by the window is released at the next real boundary`() throws {
        let log = Log()
        type("Open the PR.", in: log, at: .idle)
        type("And tag it.", in: log, at: .idle)
        try #require(log.draft.queued.count == 1)

        // The record catches up and shows the Turn running, which spends the claim.
        composer(log, at: .running).turnRead(false)
        composer(log, at: .idle).turnEnded()

        #expect(log.acts == ["send Open the PR.", "send And tag it."])
        #expect(log.draft.queued.isEmpty)
    }

    /// The one status the window must NOT queue at, and the rule this fix is not allowed to
    /// change (#1238): a live question is answered THROUGH the field, so what is typed at `asking`
    /// goes now. The put claim is read only where the Session reads as AT REST, and `asking` is a
    /// Turn paused rather than one ended — so the claim cannot reach it and the answer is never
    /// queued behind a boundary that will not come while the question stands.
    @Test
    func `an answer typed at a live question still goes now, whatever Argo just put`() throws {
        let log = Log()
        type("Open the PR.", in: log, at: .idle)
        try #require(log.draft.isAwaitingPutTurn)

        type("Yes, use the second one.", in: log, at: .asking)

        #expect(log.acts == ["send Open the PR.", "send Yes, use the second one."])
        #expect(log.draft.queued.isEmpty)
    }

    /// The same window over the REAL store, which is the seam production writes through.
    ///
    /// Its own case because the store DROPS a draft that holds nothing, and a Turn put from an
    /// empty field leaves one that is empty by every other measure — so the claim that knows the
    /// CLI is busy has to survive a write-back through `ComposerDrafts.binding(for:)` to be read
    /// at all. Held on a bare `var draft`, every other case here would pass over that bug.
    @Test
    func `the window holds through the store the cockpit writes through`() throws {
        let drafts = ComposerDrafts(now: { 0 })
        let log = Log()
        type("Open the PR.", into: drafts, log, at: .idle)
        let id = Self.session(at: .idle).sessionID
        try #require(log.acts == ["send Open the PR."])
        // The claim outlived the write-back, which is the whole of this case.
        #expect(drafts[id].isAwaitingPutTurn)

        type("And tag it.", into: drafts, log, at: .idle)

        #expect(log.acts == ["send Open the PR."])
        #expect(drafts[id].queued.map(\.text) == ["And tag it."])
    }

    /// The reading itself, named: what Return acts on in the window, over a Session every
    /// Session-side reading calls at rest.
    @Test
    func `the composer holds the Turn on its own act, over a Session that reads at rest`() throws {
        let log = Log()
        type("Open the PR.", in: log, at: .idle)
        try #require(log.draft.isAwaitingPutTurn)

        #expect(composer(log, at: .idle).holdsTurn)
        // The Session's own reading says the opposite, which is the disagreement being resolved.
        #expect(!Self.session(at: .idle).isTurnInFlight)
        #expect(Self.session(at: .idle).hasTurnEnded)
    }

    /// A steer and the boundary that follows it, which is the second way #1636 could have folded
    /// two Turns into one: the steer's own `ESC` ENDS the Turn, so the boundary arrives over a
    /// follow-up whose paste has only just landed. Delivered twice, the CLI would hold one copy in
    /// a composer the next Return submits with whatever landed after it.
    @Test
    func `a steered follow-up the boundary follows is delivered exactly once`() async throws {
        let log = Log()
        type("Open the PR.", in: log, at: .running)
        // A second follow-up BEHIND the steered one, or the boundary declines on an empty queue
        // and the claim this case is named for is never the thing that held it.
        type("And tag it.", in: log, at: .running)
        let steered = try #require(log.draft.queued.first?.id)

        await composer(log, at: .running).steering(steered)
        // The boundary the steer's own interrupt made, read at the status it produced.
        composer(log, at: .idle).turnEnded()

        #expect(log.acts == ["interrupt", "steer Open the PR."])
        // The one behind it is still waiting: the steer's boundary is not its boundary.
        #expect(log.draft.queued.map(\.text) == ["And tag it."])
    }
}
