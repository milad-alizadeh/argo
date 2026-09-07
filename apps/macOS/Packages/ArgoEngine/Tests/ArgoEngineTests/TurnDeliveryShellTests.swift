@testable import ArgoEngine
import Testing

/// The one Turn the bound must NOT end (#1595).
///
/// `TurnDeliveryBoundTests` is about a Turn the CLI took and will write no record for, which is
/// what a local `/command` does — from there the record is never going to answer, so Argo's own
/// claim ends rather than standing for ever. A `!` shell command is the opposite case wearing the
/// same silence: the CLI writes its record when the command EXITS, so a claim ended at the watch's
/// own bound leaves the feed with nothing at all for as long as the command runs.
@Suite("Turn delivery shell")
@MainActor
struct TurnDeliveryShellTests {
    @Test
    func `a shell command's claim stands until its record answers`() async {
        let watch = DeliveryRecorder(records: 1)
        watch.echo = .heard
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("! gh auth refresh -h github.com", to: "session-a")
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.ended == 0)
        #expect(watch.submitted.map(\.text) == ["! gh auth refresh -h github.com"])
        // And the watch is done looking: the claim outlives it, not the other way round.
        #expect(!delivery.isWatching("session-a"))
    }

    /// The claim ends where it always did — nothing here holds a Turn the CLI never heard.
    @Test
    func `a shell command the CLI never heard is still reported lost`() async {
        let watch = DeliveryRecorder(records: 1)
        watch.echo = .unheard
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("! ls", to: "session-a")

        #expect(await settle { watch.lost.map(\.text) == ["! ls"] })
    }

    private static let patience = Duration.milliseconds(20)

    /// Long enough that a watch which was going to do anything has done all of it — see
    /// `TurnDeliveryTests`, whose reasoning and figures these are.
    private static func pauseLongEnoughForTheWholeWatch() async {
        try? await Task.sleep(for: patience * (TurnDelivery.attempts + 3))
    }
}
