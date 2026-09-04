import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// A Stop the record never answers (#1234).
///
/// Argo writes one `ESC` and that is the whole of what it can do: whether the CLI took it is the
/// record's to say, and the record is what draws the spinner down. So a Stop that was written and
/// never reported leaves a lit button over a Session that goes on claiming to work — which is the
/// state the ticket was filed from, and the one thing the composer must not answer with silence.
///
/// It says the weaker, true thing rather than the loud one: Argo asked, and the Session has not
/// come off `running`. Never that the Turn is still running, which Argo cannot see, and never
/// that the Stop failed, which it cannot know either.
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

        #expect(log.draft.notice == ComposerDraft.stopDidNotTake)
        #expect(
            ComposerSeamNote.note(for: log.draft, enteredAtMs: 0)
                == .notice(ComposerSeamLine(ComposerDraft.stopDidNotTake)),
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

    /// Nothing to watch where no Stop was made. The wait is started by a state change rather than
    /// by the click, so it runs on arrival at a Session too — and must find nothing to say.
    @Test
    func `a composer nobody stopped waits on nothing`() async {
        let log = Log()

        await composer(log).watchStop(patience: .milliseconds(1))

        #expect(log.draft.notice == nil)
    }

    /// A refused Stop is already answered, in the port's own words, and answered LOUDER — a refusal
    /// outranks a notice on the seam. A second line about the same click would replace the reason
    /// with a vaguer one.
    @Test
    func `a refused Stop is left to say its own reason`() async {
        let log = Log()
        let driver = InMemorySessionDriver()
        driver.refusal = .notDrivable
        log.draft.stopped { try driver.interrupt("session-a") }

        await composer(log).watchStop(patience: .milliseconds(1))

        #expect(log.draft.refusal == SessionDriveError.notDrivable.detail)
        #expect(log.draft.notice == nil)
    }

    /// Every Stop gets its own watch. Counted rather than flagged, because two Stops with no
    /// boundary between them are two acts — and a flag already true the second time would key the
    /// vessel's wait to a value that never moved, so the second click would be watched by nobody.
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

    /// The line the reader is left with, kept where the test that asserts it can see it.
    @Test
    func `the seam names the act and claims nothing about the agent`() {
        #expect(ComposerDraft.stopDidNotTake == "Stop did not take. The Session is still running.")
    }
}
