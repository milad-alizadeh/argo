import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A rung picked while a Turn was running (#940). The port refuses the walk and is right to —
/// what these settle is that the intent is kept, said, and carried out at the boundary.
@MainActor
@Suite("A rung held for the Turn's end")
struct ComposerModeHeldTests {
    /// What the view wrote, in the order it wrote it — the ordering IS the claim in
    /// `the held rung is walked before the queue goes`.
    final class Log {
        var draft = ComposerDraft()
        var acts: [String] = []
    }

    /// The vessel under test, over a Session mid-Turn, with a port that answers however the case
    /// needs. Built here rather than per test so no case can quietly drive a different composer.
    private func composer(
        _ log: Log,
        refusing refusal: SessionDriveError? = SessionDriveError.modeBusy,
        isRunning: Bool = true,
    )
        -> SessionComposer {
        SessionComposer(
            composer: isRunning ? ComposerSpecimen.running : ComposerSpecimen.composer,
            intents: DeckIntents(
                send: { text, _ in log.acts.append("send \(text)") },
                settings: SessionSettingIntents(setMode: { mode in
                    log.acts.append("walk \(mode)")
                    if let refusal {
                        throw refusal
                    }
                }),
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }

    /// The whole defect: a click that reached the port, was refused, and left nothing on screen.
    /// The rung is kept AND the seam carries the port's own reason for not walking it now.
    @Test
    func `a rung refused mid-Turn is held and said`() async {
        let log = Log()

        await composer(log).walk(to: .auto)

        #expect(log.draft.heldMode == .auto)
        #expect(log.draft.notice == ComposerDraft.held(.auto))
        #expect(
            ComposerSeamNote.note(for: log.draft, enteredAtMs: 0)
                == .notice(ComposerSeamLine(ComposerDraft.held(.auto))),
        )
    }

    /// The port's word reaches the seam verbatim, which is what #940 asks for — the composer adds
    /// what it did with the intent rather than replacing the reason.
    @Test
    func `the seam repeats the port's own refusal`() {
        #expect(ComposerDraft.held(.auto).hasPrefix(SessionDriveError.modeBusy.detail))
    }

    /// Only `modeBusy` is answered. A rung Argo cannot count a distance for is not one waiting on
    /// anything, so holding it would promise a walk that will never happen.
    @Test(arguments: [SessionDriveError.modeUnreachable, .modeWalking, .notDrivable])
    func `every other refusal is repeated and nothing is held`(refused: SessionDriveError) async {
        let log = Log()

        await composer(log, refusing: refused).walk(to: .auto)

        #expect(log.draft.heldMode == nil)
        #expect(log.draft.notice == refused.detail)
    }

    /// A draft holding a rung and NOTHING else — not even the seam sentence — must survive the
    /// store, which drops empty ones. Evicted, the rung would never be walked and the picker would
    /// snap back with no word said.
    @Test
    func `a draft holding only a rung survives the store`() {
        let drafts = ComposerDrafts()

        drafts["s1"] = ComposerDraft(heldMode: .auto)

        #expect(drafts["s1"].heldMode == .auto)
        #expect(!drafts.isEmpty)
    }

    /// Stop clears the field; it does not clear the rung, and it must not claim to have cleared a
    /// vessel that held only one.
    @Test
    func `an interrupt leaves a held rung alone and says nothing about it`() {
        var draft = ComposerDraft(heldMode: .auto)

        draft.stopped(via: {})

        #expect(draft.heldMode == .auto)
        #expect(draft.notice == nil)
    }

    /// The order is the whole of what the boundary decides: a follow-up released ahead of the walk
    /// would run under a boundary its author had already moved.
    @Test
    func `the held rung is walked before the queue goes`() async {
        let log = Log()
        log.draft = ComposerDraft(queued: [QueuedTurn(text: "carry on")])

        await composer(log, refusing: nil).honour(.auto)

        #expect(log.acts == ["walk auto", "send carry on"])
        #expect(log.draft.heldMode == nil)
        #expect(log.draft.notice == nil)
    }

    /// A rung the port still refuses once the Turn is over is NOT held again: there is no boundary
    /// left for it to wait on, so holding it would leave the picker promising a walk forever.
    @Test
    func `a rung still refused once the Turn is over is not held`() async {
        let log = Log()

        await composer(log, isRunning: false).honour(.auto)

        #expect(log.draft.heldMode == nil)
        #expect(log.draft.notice == SessionDriveError.modeBusy.detail)
    }

    /// The trigger the vessel actually calls, and the one nothing else covers. It marks the walk
    /// begun synchronously, which is what stops a second boundary starting another (#653) — and it
    /// leaves the rung ON the draft, so the picker goes on drawing it while the walk runs.
    @Test
    func `the boundary begins the walk without dropping the rung`() {
        let log = Log()
        log.draft = ComposerDraft(heldMode: .auto)

        composer(log).turnEnded()

        #expect(log.draft.heldMode == .auto)
        #expect(log.draft.isWalkingMode)
    }

    /// Begun once: a rung walked twice would count its second distance from a stance the first
    /// walk had already left (#653).
    @Test
    func `only one walk can begin for one held rung`() {
        var draft = ComposerDraft()
        draft.modeHeld(.plan)

        #expect(draft.beginModeWalk() == .plan)
        #expect(draft.beginModeWalk() == nil)
    }
}
