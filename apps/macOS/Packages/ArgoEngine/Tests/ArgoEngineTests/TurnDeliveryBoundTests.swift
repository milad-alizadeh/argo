@testable import ArgoEngine
import Testing

/// The bound on Argo's own claim that a Turn is in flight (#1409).
///
/// `SessionTurnSubmission` ends on the record growing and on nothing else, so a Turn the CLI took
/// and wrote no record for left the Session reading `running` at DIRECT for the rest of the
/// window: no hand-off, a wait plinth standing over a Plan that read `6/6 done`, and a Stop that
/// could not reach the claim because an `ESC` at a prompt the CLI is already back at writes no
/// record either.
///
/// This watch is the bound, because this watch is the whole life of the claim — see
/// `TurnDelivery.over(_:)`. Its own suite rather than more of `TurnDeliveryTests`, which is at its
/// body cap: that one is about the #682 recovery, and this is about what the recovery ENDS.
@Suite("Turn delivery bound")
@MainActor
struct TurnDeliveryBoundTests {
    /// The bound. A Turn Argo could not read the composer for reports NOTHING about the words
    /// (#1266) — and the claim that a Turn is in flight still ends, because this watch is the whole
    /// life of it. Without that, `HubSession` reads `running` at DIRECT for the rest of the window.
    @Test
    func `a Turn Argo cannot read the composer for still ends the claim`() async {
        let watch = DeliveryRecorder(records: 1)
        watch.echo = .unreadable
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("what is @README.md about?", to: "session-a")
        #expect(await settle { watch.ended == 1 })

        // The WORDS are still not reported: only the claim about now ended.
        #expect(watch.lost.isEmpty)
        #expect(!delivery.isWatching("session-a"))
    }

    /// The other half of the same bound, and the one the ticket was stuck in: the CLI TOOK the
    /// Turn and wrote no record for it — which is what a local `/command` does (#1266). From there
    /// the record is the only authority, so Argo's own claim ends rather than standing for ever.
    @Test
    func `a Turn the CLI took but wrote no record for ends the claim`() async {
        let watch = DeliveryRecorder(records: 1)
        watch.echo = .heard
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("/clear", to: "session-a")

        #expect(await settle { watch.ended == 1 })
        #expect(watch.retyped == 0)
        #expect(watch.lost.isEmpty)
    }

    /// The sharp edge of the bound: a fresh Turn CANCELS the watch it replaces, and a cancelled
    /// watch must file nothing — otherwise it would end the claim the Turn that replaced it had
    /// just filed, and the new Turn would read as one nobody is running.
    @Test
    func `a Turn that replaces another leaves the new claim standing`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("First.", to: "session-a")
        delivery.typed("Second.", to: "session-a")
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.submitted.map(\.text) == ["First.", "Second."])
        // One ending, from the SECOND watch running out — never a third from the cancelled first.
        #expect(watch.ended <= 1)
    }

    private static let patience = Duration.milliseconds(20)

    /// Long enough that a watch which was going to do anything has done all of it — see
    /// `TurnDeliveryTests`, whose reasoning and figures these are.
    private static func pauseLongEnoughForTheWholeWatch() async {
        try? await Task.sleep(for: patience * (TurnDelivery.attempts + 3))
    }
}
