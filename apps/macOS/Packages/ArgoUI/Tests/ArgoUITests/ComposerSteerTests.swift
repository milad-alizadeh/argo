import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// Steering one waiting follow-up into the Turn it is waiting on (#1238).
///
/// The queue's ordinary promise is that a follow-up goes at the boundary (design decision 4). This
/// is the reader saying one of them cannot wait — the act they would make at the terminal with
/// `ESC` and a sentence.
///
/// What every case here is really about is the ONE thing a steer must not become: a Stop. It ends
/// the Turn the same way, so everything that answers an interrupt has to be told the difference.
@Suite("Composer steer")
@MainActor
struct ComposerSteerTests {
    // MARK: - The act

    @Test
    func `steering a queued follow-up interrupts the Turn, then puts its words`() async {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)

        await composer(log).steering(log.draft.queued[1].id)

        #expect(log.acts == ["interrupt", "steer And then open the PR."])
        // It leaves the queue exactly as it would have at the boundary…
        #expect(log.draft.queued.map(\.text) == ["Run the suite."])
        #expect(log.draft.steeringTurn == nil)
    }

    /// The whole of what separates a steer from Stop. An interrupt made in order to DELIVER is not
    /// the reader abandoning the run, so what is still queued behind it still means what it meant.
    @Test
    func `the follow-ups behind a steer stay queued`() async {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)

        await composer(log).steering(log.draft.queued[1].id)

        #expect(log.draft.queued.map(\.text) == ["Run the suite."])
        #expect(log.draft.notice != ComposerDraft.droppedQueue)
    }

    /// …and the record's own marker must not take them either. The steer's interrupt IS the
    /// boundary that then arrives, and `turnEnded()` drops a queue behind an interrupt it has not
    /// already answered for — so the claim the steer makes is what saves the rest.
    @Test
    func `the boundary a steer makes does not drop what is left`() async {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        await composer(log).steering(log.draft.queued[1].id)

        let mustDrop = log.draft.mustDropQueue(afterInterrupt: true)

        #expect(!mustDrop)
        #expect(log.draft.queued.map(\.text) == ["Run the suite."])
    }

    /// A Stop that is really a Stop still drops the queue: the claim a steer spends is one
    /// boundary's, not a standing exemption (#1189).
    @Test
    func `a real Stop after a steer still drops the queue`() async {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        await composer(log).steering(log.draft.queued[1].id)
        _ = log.draft.mustDropQueue(afterInterrupt: true)

        let mustDrop = log.draft.mustDropQueue(afterInterrupt: true)

        #expect(mustDrop)
    }

    // MARK: - While it is in flight

    /// The sharpest race in the feature. A steer's own interrupt ends the Turn, so the boundary
    /// arrives while the steered follow-up is still in the queue and its paste is not yet written.
    /// Released there it would go TWICE, and everything behind it would go early into a Turn the
    /// reader had just redirected.
    @Test
    func `nothing is released while a steer is in flight`() {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        _ = log.draft.beginSteer(log.draft.queued[1].id, via: {})

        let release = ComposerRelease(Self.session(at: .idle), log.draft)

        #expect(!release.flushes)
        #expect(!release.walks)
    }

    /// The same race one step later, and the one a first pass got wrong. The paste has LANDED, so
    /// the steered follow-up leaves the queue — but the status is still the one this steer's own
    /// interrupt produced, and it reads `idle`. Released on that reading the whole queue would
    /// follow the steered follow-up into the very Turn it was steering.
    @Test
    func `nothing is released on the status a steer's own interrupt produced`() {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        let steered = log.draft.queued[1].id
        _ = log.draft.beginSteer(steered, via: {})

        log.draft.steerLanded(steered)

        #expect(!ComposerRelease(Self.session(at: .idle), log.draft).flushes)
    }

    /// …and it comes back once the record has caught up: a Turn seen RUNNING is what makes the
    /// status trustworthy again, and the boundary after that one is a real one.
    @Test
    func `the release comes back once the record has seen the steered Turn`() {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        let steered = log.draft.queued[1].id
        _ = log.draft.beginSteer(steered, via: {})
        log.draft.steerLanded(steered)

        // The record shows the steered Turn running — the vessel's own `hasTurnEnded` false edge.
        composer(log).turnRead(false)

        #expect(ComposerRelease(Self.session(at: .idle), log.draft).flushes)
    }

    /// A steer in flight is a Turn in flight, whatever the status says: its own `ESC` ended the
    /// last one, so `isRunning` reads false for the whole of the pause. A Return sent straight
    /// through there would reach the CLI AHEAD of the follow-up the reader chose to send first.
    @Test
    func `a follow-up typed during the pause queues behind the steered one`() {
        let log = Log()
        queue(["Run the suite."], in: log)
        _ = log.draft.beginSteer(log.draft.queued[0].id, via: {})

        log.draft.text = "Actually, do the caption first."
        // The reading `submit()` makes while a steer is in flight.
        log.draft.submit(whileTurnInFlight: log.draft.steeringTurn != nil) { text, _ in
            log.acts.append("send \(text)")
        }

        #expect(log.acts.isEmpty)
        #expect(log.draft.queued.map(\.text).contains("Actually, do the caption first."))
    }

    /// The chip says what is happening to it. Without this the reader clicks and watches nothing
    /// change for the length of the pause the CLI needs.
    @Test
    func `the steered follow-up says it is sending, and the others do not`() {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        let steered = log.draft.queued[1].id

        _ = log.draft.beginSteer(steered, via: {})

        #expect(log.draft.standing(of: steered) == .steering)
        #expect(log.draft.standing(of: log.draft.queued[0].id) == .queued)
    }

    /// Neither control is offered while it is in flight: the interrupt has landed, so there is no
    /// longer a Turn to keep the words back from, and a cancel racing the paste would take back a
    /// follow-up the agent may already have.
    @Test
    func `a steer in flight offers no control at all`() {
        #expect(!QueuedTurnStanding.steering.isActionable)
        #expect(QueuedTurnStanding.queued.isActionable)
        #expect(QueuedTurnStanding.notSent.isActionable)
    }

    /// One at a time. A second steer would put a second `ESC` into a Turn the first already ended,
    /// and its words into a prompt the first is still pasting at.
    @Test
    func `a second steer is refused while one is in flight`() {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        _ = log.draft.beginSteer(log.draft.queued[1].id, via: {})

        let second = log.draft.beginSteer(log.draft.queued[0].id, via: {})

        #expect(second == nil)
    }

    // MARK: - When it does not go

    /// A refused INTERRUPT stops the act where it stands: nothing was stopped, so the chip is
    /// still simply queued and the reason goes to the seam — decision 8's rule read at this act.
    @Test
    func `a refused interrupt moves nothing`() async {
        let log = Log()
        queue(["And then open the PR."], in: log)
        let id = log.draft.queued[0].id

        await composer(log, refusing: .notDrivable).steering(id)

        #expect(log.acts == ["interrupt"])
        #expect(log.draft.queued.count == 1)
        #expect(log.draft.steeringTurn == nil)
        #expect(log.draft.standing(of: id) == .queued)
        #expect(log.draft.refusal == SessionDriveError.notDrivable.detail)
    }

    /// The interrupt landed and the words did not. The Turn is over either way, so the follow-up
    /// stays queued for the ordinary release — and the seam and the chip both say which one it was.
    @Test
    func `a steer whose words are refused keeps the follow-up and says so`() async {
        let log = Log()
        queue(["Run the suite.", "And then open the PR."], in: log)
        let id = log.draft.queued[1].id

        await composer(log, refusingSteer: .notDrivable).steering(id)

        #expect(log.draft.queued.count == 2)
        #expect(log.draft.standing(of: id) == .notSent)
        #expect(
            ComposerSeamNote.note(for: log.draft, enteredAtMs: 0)
                == .refusal(ComposerSeamLine(SessionDriveError.notDrivable.detail)),
        )
    }

    /// Steering something that is no longer queued — cancelled between the click and the act — is
    /// silence, not an interrupt. A Turn must never be stopped for words that are not there.
    @Test
    func `steering a follow-up that is gone stops nothing`() async {
        let log = Log()
        queue(["And then open the PR."], in: log)
        let id = log.draft.queued[0].id
        log.draft.cancel(id)

        await composer(log).steering(id)

        #expect(log.acts.isEmpty)
    }
}
