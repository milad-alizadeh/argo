import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// The window between the record answering a Turn and the status turning, and where a Turn typed
/// inside it goes (#1636).
///
/// Two Turns sent while a Session was busy arrived as ONE prompt and one bubble, their texts run
/// together with no space between them. Neither reading the composer asks could see the CLI was
/// busy: `hasUnansweredTurn` — Argo's own submit — is spent by the record growing by ANYTHING,
/// and `events.count` counts folded events, of which 24 of 26 kinds grow it without opening a
/// Turn. `.recordIdentity` leads every message-bearing record, ahead of the `.prompt` that opens
/// the Turn, so the claim is routinely spent a fold before the status word turns. The second Turn
/// then took the straight-send branch into a PTY the CLI was busy on.
///
/// What closes it is the claim the composer already makes about its own act: a Turn it PUT that
/// the record has yet to show running (#1337). The release has read it since #1337 precisely
/// because the status is not merely stale there but actively WRONG — and the submit, deciding the
/// same question from the other side, was not reading it at all. Its own suite because the claim
/// is about where a Turn GOES, which is neither the release's question nor the put wait's.
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

    /// A steer and the boundary that follows it, which is the second way #1636 could have folded
    /// two Turns into one: the steer's own `ESC` ENDS the Turn, so the boundary arrives over a
    /// follow-up whose paste has only just landed. Delivered twice, the CLI would hold one copy in
    /// a composer the next Return submits with whatever landed after it.
    @Test
    func `a steered follow-up the boundary follows is delivered exactly once`() async throws {
        let log = Log()
        type("Open the PR.", in: log, at: .running)
        let steered = try #require(log.draft.queued.first?.id)

        await composer(log, at: .running).steering(steered)
        // The boundary the steer's own interrupt made, read at the status it produced.
        composer(log, at: .idle).turnEnded()

        #expect(log.acts == ["interrupt", "steer Open the PR."])
        #expect(log.draft.queued.isEmpty)
    }
}
