@testable import ArgoEngine
import Testing

/// Watching for the CLI to answer a Turn that was typed at it (#682).
///
/// The patience is a tenth of a second here rather than the three seconds a real Turn is given —
/// what these assert is the SHAPE of the watch, and the real wait is a fact about how long an agent
/// takes to write its first record.
@Suite("Turn delivery")
@MainActor
struct TurnDeliveryTests {
    /// A record is the CLI saying it heard: nothing more is typed, and nothing is reported.
    @Test
    func `a Turn the CLI wrote a record for is left alone`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("Fix the caption.", to: "session-a")
        watch.records = 2
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.retyped == 0)
        #expect(watch.lost.isEmpty)
    }

    /// The Turn reported for the roster to draw `running` on (#1048) is counted from the record
    /// this same watch measures silence against, and not from a second reading of its own.
    @Test
    func `the Turn reported and the silence watched are counted from one record`() {
        let watch = DeliveryRecorder(records: 7)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("Fix the caption.", to: "session-a")
        watch.records = 8

        #expect(watch.submitted == [
            SessionTurnSubmission(text: "Fix the caption.", recordsWhenSubmitted: 7),
        ])
    }

    /// The failure this exists for: the Return was eaten, so the transcript never moved. Argo types
    /// another one rather than leaving a Turn that looks sent and never ran.
    @Test
    func `silence is answered with another Return`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("what is @README.md about?", to: "session-a")

        #expect(await settle { watch.retyped >= 1 })
    }

    /// A Return that works on the second try is the whole point — and once the record moves, the
    /// watch stops rather than going on typing at a Session that is now running.
    @Test
    func `a Return that lands stops the watch where it is`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)
        watch.onRetype = { watch.records += 1 }

        delivery.typed("Carry on.", to: "session-a")
        #expect(await settle { watch.retyped == 1 })
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.retyped == 1)
        #expect(watch.lost.isEmpty)
    }

    /// Silence all the way through: the Turn is reported, verbatim, so the words can go back where
    /// they were typed. Bounded rather than endless — past two more Returns the silence is not
    /// about timing and another keystroke will not fix it.
    @Test
    func `a Turn that is never heard is reported with its words`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("what is @README.md about?", to: "session-a")
        #expect(await settle { !watch.lost.isEmpty })

        #expect(watch.retyped == TurnDelivery.attempts)
        #expect(watch.lost.map(\.text) == ["what is @README.md about?"])
        #expect(watch.lost.map(\.sessionID) == ["session-a"])
    }

    /// No PTY answers any more, so there is nothing left to retype into. Reported at once rather
    /// than after the remaining waits: the answer cannot change.
    @Test
    func `a Session whose PTY has gone is reported without waiting out the retries`() async {
        let watch = DeliveryRecorder(records: 1)
        watch.canRetype = false
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("Off you go.", to: "session-a")
        #expect(await settle { !watch.lost.isEmpty })

        #expect(watch.retyped == 0)
        #expect(watch.lost.map(\.text) == ["Off you go."])
    }

    /// One Session has one composer, so a second Turn replaces the first as the one in flight.
    /// Without this the older watch would go on typing Returns at a Turn nobody is waiting for.
    @Test
    func `a second Turn replaces the first as the one being watched`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("First", to: "session-a")
        delivery.typed("Second", to: "session-a")
        #expect(await settle { !watch.lost.isEmpty })
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.lost.map(\.text) == ["Second"])
    }

    /// A Session being torn down is left where it stands: a Turn nobody can retype is not news the
    /// composer could act on, and the roster already says the Session is gone.
    ///
    /// It types nothing either, which is what `SpawnFixture.typeTurn` stands on: a dropped watch
    /// still spending its Returns would go on writing at the PTY those suites count the writes of
    /// (#1040).
    @Test
    func `a forgotten Session is left alone`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("Off you go.", to: "session-a")
        delivery.forget("session-a")
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.retyped == 0)
        #expect(watch.lost.isEmpty)
    }

    /// The ticket's own report: a local command is heard the instant it is typed and writes no
    /// record at all, so the composer letting it go is the only thing that says it arrived.
    @Test
    func `a command that writes no record is not reported lost`() async {
        let watch = DeliveryRecorder(records: 4)
        watch.echo = .heard
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("/clear", to: "session-a")
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.lost.isEmpty)
        #expect(watch.retyped == 0)
    }

    /// A Session slow to write its first record — a resume reading 295k of context — has still
    /// taken the Turn, and its composer says so.
    @Test
    func `a Session that has taken the Turn gets no further Return`() async {
        let watch = DeliveryRecorder(records: 0)
        watch.echo = .heard
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("Carry on where you left off.", to: "session-a")
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.retyped == 0)
        #expect(watch.lost.isEmpty)
    }

    /// Nothing to read the composer off — no screen wired, or none drawn yet. The Returns still go,
    /// because one at a composer holding nothing does nothing; the notice does not, because a Turn
    /// wrongly called lost is sent twice by the reader who believes it.
    @Test
    func `a Turn Argo cannot read the composer for is left standing`() async {
        let watch = DeliveryRecorder(records: 1)
        watch.echo = .unreadable
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)

        delivery.typed("what is @README.md about?", to: "session-a")
        #expect(await settle { watch.retyped == TurnDelivery.attempts })
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.lost.isEmpty)
    }

    /// The composer let the Turn go on the second Return: heard, so the watch stops there and says
    /// nothing.
    @Test
    func `a composer that empties mid-watch ends it`() async {
        let watch = DeliveryRecorder(records: 1)
        let delivery = TurnDelivery(watch.watch, patience: Self.patience)
        watch.onRetype = { watch.echo = .heard }

        delivery.typed("what is @README.md about?", to: "session-a")
        #expect(await settle { watch.retyped == 1 })
        await Self.pauseLongEnoughForTheWholeWatch()

        #expect(watch.retyped == 1)
        #expect(watch.lost.isEmpty)
    }

    private static let patience = Duration.milliseconds(20)

    /// Long enough that a watch which was going to do anything has done all of it. Only for the
    /// claims that are about something NOT happening — everything else waits on the thing itself
    /// through `settle`, because a wall-clock guess is how a suite under load goes green on a race
    /// it never actually ran.
    ///
    /// Sleeps rather than yields: what is being waited on is a `Task.sleep`, and a yield loop
    /// re-enqueues on the main actor without ever letting the clock run.
    private static func pauseLongEnoughForTheWholeWatch() async {
        try? await Task.sleep(for: patience * (attempts + 2))
    }

    /// One more wait than the watch takes, so the pause outlasts it.
    private static let attempts = TurnDelivery.attempts + 1
}
