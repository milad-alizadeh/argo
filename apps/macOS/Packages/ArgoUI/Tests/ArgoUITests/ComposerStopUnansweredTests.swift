import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A Stop the record never answers (#1234).
///
/// Argo writes one `ESC` and that is the whole of what it can do: whether the CLI took it is the
/// record's to say, and the record is what draws the spinner down. So a Stop that was written and
/// never reported leaves a lit button over a Session that goes on claiming to work — the one thing
/// the composer must not answer with silence.
@MainActor
@Suite("A Stop the record did not answer")
struct ComposerStopUnansweredTests {
    final class Log {
        var draft = ComposerDraft()
    }

    private func composer(_ log: Log, isRunning: Bool = true) -> SessionComposer {
        SessionComposer(
            composer: isRunning ? ComposerSpecimen.running : ComposerSpecimen.composer,
            intents: DeckIntents(draft: Binding(get: { log.draft }, set: { log.draft = $0 })),
        )
    }

    /// The whole defect: Stop was pressed, the wait went by, and nothing on screen changed.
    @Test
    func `a Stop no boundary answers is reported on the seam`() async {
        let log = Log()
        log.draft.stopped(via: {})

        await composer(log).watchStop(patience: .milliseconds(1))

        #expect(log.draft.notice == ComposerDraft.stopDidNotTakeNotice)
        #expect(
            ComposerSeamNote.note(for: log.draft, enteredAtMs: 0)
                == .notice(ComposerSeamLine(ComposerDraft.stopDidNotTakeNotice)),
        )
    }

    /// The ordinary case, and the one a line here would cry wolf over: the Stop landed, the record
    /// reported it, and the composer answered the boundary before the wait was up.
    @Test
    func `a Stop the boundary answers says nothing`() async {
        let log = Log()
        log.draft.stopped(via: {})
        _ = log.draft.mustDropQueue(afterInterrupt: true)

        await composer(log).watchStop(patience: .milliseconds(1))

        #expect(log.draft.notice == nil)
    }

    /// The race the wait cannot win by looking first: the boundary lands WHILE it sleeps. The
    /// vessel's own wait is cancelled by the count moving, but cancellation is a courtesy of the
    /// render — the outcome itself has to refuse to speak, or a Stop the record answered late puts
    /// a line up over a Session that came off `running` seconds ago.
    @Test
    func `a boundary that lands during the wait takes the line back`() {
        var draft = ComposerDraft()
        draft.stopped(via: {})
        _ = draft.mustDropQueue(afterInterrupt: true)

        draft.stopDidNotTake()

        #expect(draft.notice == nil)
    }

    /// The line is a claim about what is happening NOW, so it cannot outlive the news that answers
    /// it. A boundary arriving after the wait gave up — a slow file watch, an `ESC` the CLI took a
    /// while to unwind — takes it down, or the seam goes on saying the Session is running over one
    /// that has been idle for minutes.
    @Test
    func `a boundary after the line went up takes it back down`() {
        let log = Log()
        log.draft.stopped(via: {})
        log.draft.stopDidNotTake()
        #expect(log.draft.notice == ComposerDraft.stopDidNotTakeNotice)

        composer(log, isRunning: false).turnEnded()

        #expect(log.draft.notice == nil)
    }

    /// It takes down its OWN line and no other. A drop the same boundary reported is news the
    /// reader still needs.
    @Test
    func `the retraction leaves another line standing`() {
        var draft = ComposerDraft()
        draft.text = "And then open the PR."
        draft.submit(whileRunning: true) { _, _ in }
        draft.stopped(via: {})
        #expect(draft.notice == ComposerDraft.droppedQueue)

        draft.stopTookAfterAll()

        #expect(draft.notice == ComposerDraft.droppedQueue)
    }

    /// Nothing to watch where no Stop was made. The wait is started by a state change rather than
    /// by the click, so it runs on arrival at a Session too — and must find nothing to say.
    @Test
    func `a composer nobody stopped waits on nothing`() async {
        let log = Log()

        await composer(log).watchStop(patience: .milliseconds(1))

        #expect(log.draft.notice == nil)
    }

    /// A Stop the port would not take is not a Stop in flight, so it is never counted and there is
    /// nothing here to speak about — the port's own reason stands alone, where a vaguer line about
    /// the same click would only compete with it.
    ///
    /// The count is what the claim rests on: a refused Stop that DID count would have this watch
    /// talking over the reason a moment later.
    @Test
    func `a refused Stop is never counted, so the port's reason stands alone`() async {
        let log = Log()
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        log.draft.stopped { try driver.interrupt("session-a") }
        #expect(log.draft.unansweredStops == 0)

        await composer(log).watchStop(patience: .milliseconds(1))

        #expect(log.draft.refusal == SessionDriveError.notDrivable.detail)
        #expect(log.draft.notice == nil)
    }

    /// Every Stop gets its own watch: the vessel keys its wait to this count, so a second Stop with
    /// no boundary between must move it or nobody watches that click.
    @Test
    func `a second Stop before any boundary is a second thing to watch`() {
        var draft = ComposerDraft()

        draft.stopped(via: {})
        #expect(draft.unansweredStops == 1)
        draft.stopped(via: {})
        #expect(draft.unansweredStops == 2)

        // One boundary answers whatever is outstanding: the record reports the act, not the clicks.
        _ = draft.mustDropQueue(afterInterrupt: true)
        #expect(draft.unansweredStops == 0)
    }
}
