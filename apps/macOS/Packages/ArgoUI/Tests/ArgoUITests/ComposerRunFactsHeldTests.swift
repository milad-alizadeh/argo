import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A Model or an Effort rung picked while a Turn was running (#1329). The port refuses the line —
/// `runFactsBusy` — and is right to; what these settle is that the intent is kept, said, and
/// carried out at the boundary, the way a Mode rung already is (#940).
@MainActor
@Suite("Model and Effort held for the Turn's end")
struct ComposerRunFactsHeldTests {
    // MARK: Criterion 1 & 2 — a Model or an Effort picked mid-Turn is held and said

    @Test
    func `a Model refused mid-Turn is held and said`() async {
        let log = Log()

        await composer(log).setModel("claude-sonnet-5")

        #expect(log.draft.heldModel == "claude-sonnet-5")
        #expect(log.draft.notice == ComposerDraft.held(model: "claude-sonnet-5"))
    }

    @Test
    func `an Effort rung refused mid-Turn is held and said`() async {
        let log = Log()

        await composer(log).setEffort(.xhigh)

        #expect(log.draft.heldEffort == .xhigh)
        #expect(log.draft.notice == ComposerDraft.held(effort: .xhigh))
    }

    @Test
    func `the seam repeats the port's own refusal`() {
        #expect(ComposerDraft.held(model: "claude-sonnet-5")
            .hasPrefix(SessionDriveError.runFactsBusy.detail))
        #expect(ComposerDraft.held(effort: .xhigh).hasPrefix(SessionDriveError.runFactsBusy.detail))
    }

    /// Only `runFactsBusy` is answered. Anything else is not one knob waiting on a boundary.
    @Test(arguments: [SessionDriveError.notDrivable, .runFactsUnsupported])
    func `every other refusal is repeated and nothing is held`(refused: SessionDriveError) async {
        let log = Log()

        await composer(log, refusingModel: refused).setModel("claude-sonnet-5")

        #expect(log.draft.heldModel == nil)
        #expect(log.draft.notice == refused.detail)
    }

    // MARK: Criterion 4 — held under a Permission or a question too

    /// `SessionStatus.takesTypedLine` is false under `permission` and `asking` as well as
    /// `running` — the trap #1329 names. A composer that reads `isRunning == false` but
    /// `hasTurnEnded == false` is exactly that pause, and the port refuses the same way.
    @Test
    func `a pick made under a Permission or a question is held too`() async {
        let log = Log()

        await composer(log, isRunning: false, hasTurnEnded: false).setModel("claude-sonnet-5")

        #expect(log.draft.heldModel == "claude-sonnet-5")
    }

    // MARK: A draft holding only a Model or an Effort survives the store

    @Test
    func `a draft holding only a held Model survives the store`() {
        let drafts = ComposerDrafts()
        var draft = ComposerDraft()
        draft.heldModel = "claude-sonnet-5"

        drafts["s1"] = draft

        #expect(drafts["s1"].heldModel == "claude-sonnet-5")
        #expect(!drafts.isEmpty)
    }

    @Test
    func `a draft holding only a held Effort survives the store`() {
        let drafts = ComposerDrafts()
        var draft = ComposerDraft()
        draft.heldEffort = .high

        drafts["s1"] = draft

        #expect(drafts["s1"].heldEffort == .high)
        #expect(!drafts.isEmpty)
    }

    // MARK: Criterion 5 — a Stop keeps a held Model or Effort, and drops the queue as it does today

    @Test
    func `an interrupt leaves a held Model and Effort alone and says nothing about it`() {
        var draft = ComposerDraft()
        draft.heldModel = "claude-sonnet-5"
        draft.heldEffort = .xhigh

        draft.stopped(via: {})

        #expect(draft.heldModel == "claude-sonnet-5")
        #expect(draft.heldEffort == .xhigh)
        #expect(draft.notice == nil)
    }

    // MARK: Criterion 3 — both land at the boundary, before the queued follow-ups go

    /// The order is the whole of what the boundary decides: Model then Effort, then the queue —
    /// `honourRunFacts(_:)`'s own order, read the way `honour(_:)`'s is.
    @Test
    func `the held Model and Effort are walked before the queue goes`() async {
        let log = Log()
        log.draft = ComposerDraft(queued: [QueuedTurn(text: "carry on")])
        log.draft.heldModel = "claude-sonnet-5"
        log.draft.heldEffort = .xhigh

        await composer(
            log,
            refusingModel: nil,
            refusingEffort: nil,
            isRunning: false,
        ).honourRunFacts((model: "claude-sonnet-5", effort: .xhigh))

        #expect(log.acts == ["model claude-sonnet-5", "effort xhigh", "send carry on"])
        #expect(log.draft.heldModel == nil)
        #expect(log.draft.heldEffort == nil)
        #expect(log.draft.notice == nil)
    }

    /// The held rung goes ahead of Model and Effort — the whole reason `release()` checks
    /// `walksRunFacts` only once `walks` (the rung) is spent.
    @Test
    func `release walks the held rung before it will walk a held Model or Effort`() {
        var draft = ComposerDraft(heldMode: .auto)
        draft.heldModel = "claude-sonnet-5"
        let release = ComposerRelease(projection(isRunning: false), draft)

        #expect(release.walks)
        #expect(!release.walksRunFacts)
    }

    @Test
    func `release walks a held Model once no rung is left waiting`() {
        var draft = ComposerDraft()
        draft.heldModel = "claude-sonnet-5"
        let release = ComposerRelease(projection(isRunning: false), draft)

        #expect(!release.walks)
        #expect(release.walksRunFacts)
    }

    /// The queue itself waits behind both — a follow-up put ahead of a held Model would run under
    /// a Session the composer had just told the reader a pick was still waiting on.
    @Test
    func `release does not put the queue while a Model or an Effort is still held`() {
        var draft = ComposerDraft(queued: [QueuedTurn(text: "carry on")])
        draft.heldEffort = .xhigh
        let release = ComposerRelease(projection(isRunning: false), draft)

        #expect(!release.putsNext)
    }

    // MARK: Criterion 7 — a held knob the Session refuses at the boundary is cleared, not re-held

    @Test
    func `a Model still refused once the Turn is over is not held again`() async {
        let log = Log()

        await composer(log, refusingModel: .notDrivable, isRunning: false)
            .honourRunFacts((model: "claude-sonnet-5", effort: nil))

        #expect(log.draft.heldModel == nil)
        #expect(log.draft.notice == SessionDriveError.notDrivable.detail)
    }

    // MARK: Criterion 6 — a Reset picked mid-Turn holds all three knobs, and lands all three

    @Test
    func `a Reset refused mid-Turn holds all three knobs`() async {
        let log = Log()

        composer(
            log,
            refusingModel: .runFactsBusy,
            refusingEffort: .runFactsBusy,
            refusingMode: .modeBusy,
        ).resetRunFacts()
        // `resetRunFacts` fires a detached `Task`; give it a beat to run each of the three awaits.
        try? await Task.sleep(for: .milliseconds(50))

        #expect(log.draft.heldMode == RunFacts.defaultMode)
        #expect(log.draft.heldModel == RunFactsModel.default.id)
        #expect(log.draft.heldEffort == RunFacts.defaultEffort)
    }

    /// A genuine refusal on the first knob still stops the rest — only a HOLD carries all three
    /// through, on the rule `resetRunFacts()`'s own comment states.
    @Test
    func `a Reset genuinely refused on Mode never reaches Model or Effort`() async {
        let log = Log()

        composer(log, refusingMode: .modeUnreachable).resetRunFacts()
        try? await Task.sleep(for: .milliseconds(50))

        #expect(log.acts == ["walk code"])
        #expect(log.draft.heldMode == nil)
        #expect(log.draft.notice == SessionDriveError.modeUnreachable.detail)
    }
}
