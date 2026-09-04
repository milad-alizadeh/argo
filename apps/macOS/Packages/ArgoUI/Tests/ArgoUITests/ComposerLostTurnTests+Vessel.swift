import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// The same news read at the vessel rather than the draft: what the composer does with it as it
/// arrives, which is where it is spent (#1183). Its own file because the two readings need two
/// different fixtures — these drive a `SessionComposer` over a projection, and the draft's own
/// cases need nothing but a `ComposerDraft`.
@MainActor
extension ComposerLostTurnTests {
    /// The re-entry case: the draft store outlives the deck, so a reader coming back meets a
    /// composer whose notice is already standing and an `initial: true` pass carrying the same
    /// standing news. Left filed, that news greets them again on the next return (#1183).
    @Test
    func `news the composer has already shown is spent off the Hub`() {
        let log = Log()
        log.draft.say(ComposerSeamLine(ComposerDraft.lost))

        composer(log).lostTurnArrived("Off you go.")

        #expect(log.filed == nil)
    }

    /// The words are the draft's business and the news is the Hub's, and the two are not one
    /// decision: a reader mid-sentence keeps every character AND the news is spent.
    @Test
    func `a reader mid-sentence keeps their sentence and the news is still spent`() {
        let log = Log()
        log.draft = ComposerDraft(text: "Something else entirely")

        composer(log).lostTurnArrived("Off you go.")

        #expect(log.draft.text == "Something else entirely")
        #expect(log.filed == nil)
    }

    /// A Turn the feed is drawing running is not one the CLI never heard (#1176), and that verdict
    /// is spent too — left filed, it would re-announce over the answer to its own sentence.
    @Test
    func `a Turn the feed is drawing running spends the news without a word`() {
        let log = Log()

        composer(log, isRunning: true).lostTurnArrived("Off you go.")

        #expect(log.draft.notice == nil)
        #expect(log.draft.text.isEmpty)
        #expect(log.filed == nil)
    }

    /// The re-entry case as the vessel meets it: the line standing from the last visit, and a Hub
    /// holding nothing because that visit spent it. The reader has read this; they are not told
    /// again (#1183).
    @Test
    func `a line the reader met last visit is not standing when they return`() {
        let log = Log()
        log.filed = nil
        log.draft.say(ComposerSeamLine(ComposerDraft.lost))

        composer(log).arrived()

        #expect(log.draft.notice == nil)
        #expect(ComposerSeamNote.note(for: log.draft, enteredAtMs: 0) == nil)
    }

    /// The first visit, where the standing news IS this visit's. Two `initial: true` passes fire
    /// on one arrival and SwiftUI owns their order, so the reader is told exactly once either way.
    @Test(arguments: [false, true])
    func `news standing on arrival is said whichever pass runs first`(arrivedFirst: Bool) {
        let log = Log()
        let vessel = composer(log, newsStanding: true)

        if arrivedFirst {
            vessel.arrived()
            vessel.lostTurnArrived("Off you go.")
        } else {
            vessel.lostTurnArrived("Off you go.")
            vessel.arrived()
        }

        #expect(log.draft.notice == ComposerDraft.lost)
        #expect(log.draft.text == "Off you go.")
        #expect(log.filed == nil)
    }

    /// Arriving takes down the lost line and nothing else: a rung held for the Turn's boundary is
    /// still held when the reader comes back, and the sentence explaining it has to come back too.
    @Test
    func `arriving leaves every other notice where it stands`() {
        let log = Log()
        log.filed = nil
        log.draft.modeHeld(.plan)

        composer(log).arrived()

        #expect(log.draft.notice == ComposerDraft.held(.plan))
    }

    /// What the vessel wrote, and the Hub's own `lostTurn` behind it: `filed` starts holding the
    /// news exactly as the ledger does, so a case that never spends it reads as still filed.
    final class Log {
        var draft = ComposerDraft()
        var filed: String? = "Off you go."
    }

    /// The vessel under test, built here so no case can quietly drive a different composer.
    /// `newsStanding` is what the Hub is holding as the vessel reads it, which is the only thing
    /// `arrived()` decides on.
    private func composer(
        _ log: Log,
        isRunning: Bool = false,
        newsStanding: Bool = false,
    )
        -> SessionComposer {
        SessionComposer(
            composer: Self.projection(isRunning: isRunning, newsStanding: newsStanding),
            intents: DeckIntents(
                lostTurnSeen: { log.filed = nil },
                draft: Binding(get: { log.draft }, set: { log.draft = $0 }),
            ),
        )
    }

    /// The specimen Session, varied by the one fact each case is about. Built rather than taken
    /// whole because no specimen carries a standing `lostTurn`: the renders have nothing to draw
    /// off it that the seam's own notice does not already draw.
    private static func projection(
        isRunning: Bool,
        newsStanding: Bool,
    )
        -> SessionComposerProjection.Composer {
        let specimen = isRunning ? ComposerSpecimen.running : ComposerSpecimen.composer
        return SessionComposerProjection.Composer(
            sessionID: specimen.sessionID,
            placeholder: specimen.placeholder,
            facts: specimen.facts,
            standingAllows: specimen.standingAllows,
            isRunning: specimen.isRunning,
            mode: specimen.mode,
            modeDidNotTake: nil,
            lostTurn: newsStanding ? "Off you go." : nil,
            canAttach: specimen.canAttach,
            canRunCommands: specimen.canRunCommands,
        )
    }
}
