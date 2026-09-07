@testable import ArgoEngine
import Testing

/// The fast path onto a Project's Deliveries (#1579): when it derives, what it does with a socket
/// that will not open, and what it leaves behind when the Project closes. What one derivation LANDS
/// is `DeliveryDerivationTests`'.
///
/// Nothing here opens a real connection or creates a real hook: the watch is scripted and the
/// sleeper is fake.
///
/// Bounded, because every wait in here is for a derivation the socket is meant to raise: a
/// regression that stops it reconnecting would otherwise hang the Swift gate rather than refuse the
/// push.
@Suite("Delivery socket", .timeLimit(.minutes(1)))
struct DeliverySocketTests {
    private let target = PortReadTarget.codeHost()

    @Test
    func `a socket that opens derives once before it waits for a move`() async {
        // The resync AC 4 asks for: a socket that was down missed deliveries and the host never
        // repeats them, so connecting is itself a reason to derive.
        let watching = Watching([.carrying(0)])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.wait.untilTick()
        await watching.socket.stop()

        #expect(await watching.watch.openCount() == 1)
        #expect(await watching.derivations.derived() == 1)
    }

    @Test
    func `every move the host pushes derives again`() async {
        let watching = Watching([.carrying(3)])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.derivations.untilDerived(4)
        await watching.socket.stop()

        // One for the connection, then one per move.
        #expect(await watching.derivations.derived() == 4)
        #expect(await watching.watch.openCount() == 1)
    }

    @Test
    func `a socket that dropped is dialled again and derives before it listens`() async {
        // Every reconnect resyncs, not just the first connection: the deliveries that arrived while
        // the socket was down are gone and nothing will repeat them.
        let watching = Watching([.carrying(0)], between: .milliseconds(1))

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.derivations.untilDerived(3)
        await watching.socket.stop()

        #expect(await watching.watch.openCount() >= 3)
    }

    @Test
    func `a watch the host will not open derives nothing`() async {
        // The grant that may not make a hook, the repository the user does not administer, the
        // create that was refused and the dial that failed are one case: no socket, no derivation,
        // and the poll carries the Project at its own pace.
        let watching = Watching([.refused])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.wait.untilTick()
        await watching.socket.stop()

        #expect(await watching.watch.openCount() == 1)
        #expect(await watching.derivations.derived() == 0)
    }

    @Test
    func `a watch the host will not open reports the dial failure`() async {
        // #1643: the degrade-down above is unchanged, but a dial that never opens is no longer
        // total silence — this is the reading a person or a test can now see.
        let watching = Watching([.refused])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.failures.untilReported(1)
        await watching.socket.stop()

        #expect(await watching.failures.count() == 1)
        #expect(await watching.failures.last()?.projectID == "P1")
    }

    @Test
    func `a dial that keeps being refused backs off as far as the poll's own interval`() async {
        // The ceiling is the point: a socket that never opens costs nothing over the poll already
        // running, so the last thing it should do is keep asking faster than the read it beats.
        let waits = SocketWaits()
        let socket = DeliverySocket(
            watch: ScriptedCodeHostWatch([.refused]),
            derive: SocketDerivations().derive,
            sleep: waits.sleep,
        )

        await socket.point(.ready(target.binding), at: "P1")
        await waits.untilWaited(7)
        await socket.stop()

        let asked = await waits.waits().prefix(7)
        #expect(Array(asked) == [2, 4, 8, 16, 32, 60, 60].map(Duration.seconds))
        #expect(asked.allSatisfy { $0 <= DeliveryPoll.interval })
    }

    @Test
    func `a socket that carried a move resets the backoff`() async {
        // A socket the host merely dropped after real work is not the host declining to push, and
        // treating the two alike would leave an ordinary reconnect waiting a minute.
        let waits = SocketWaits()
        let socket = DeliverySocket(
            watch: ScriptedCodeHostWatch([.carrying(1)]),
            derive: SocketDerivations().derive,
            sleep: waits.sleep,
        )

        await socket.point(.ready(target.binding), at: "P1")
        await waits.untilWaited(3)
        await socket.stop()

        #expect(await waits.waits().prefix(3) == [.seconds(1), .seconds(1), .seconds(1)])
    }

    @Test
    func `a socket that opens and carries nothing backs off like a refused dial`() async {
        // A forwarder that takes the dial and drops at once — a withdrawn preview, a scope revoked
        // mid-run — would otherwise reconnect every second forever, and each turn costs a hook
        // create plus a whole derivation: many times the request rate of the poll this spares.
        let waits = SocketWaits()
        let socket = DeliverySocket(
            watch: ScriptedCodeHostWatch([.carrying(0)]),
            derive: SocketDerivations().derive,
            sleep: waits.sleep,
        )

        await socket.point(.ready(target.binding), at: "P1")
        await waits.untilWaited(4)
        await socket.stop()

        #expect(await Array(waits.waits().prefix(4)) == [2, 4, 8, 16].map(Duration.seconds))
    }

    @Test
    func `a Project that closes leaves no socket open behind it`() async {
        let watching = Watching([.carrying(0)])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.wait.untilTick()
        await watching.socket.point(.unbound, at: nil)
        // Yielded until the cancelled wait has resumed and recorded itself, bounded so a run that
        // never ends fails here rather than hanging the suite.
        for _ in 1 ... 200 where await watching.waits.cancels() == 0 {
            await Task.yield()
        }

        #expect(await watching.waits.cancels() == 1)
        #expect(await watching.watch.openCount() == 1)
        // Closed rather than merely abandoned: the socket is what GitHub reaps the hook on, so a
        // run that walked away from one would leave a hook standing until the process died.
        #expect(await watching.watch.lastOpened()?.closeCount() == 1)
    }

    @Test
    func `a Project with no code host Binding dials nothing at all`() async {
        let watching = Watching([.carrying(0)])

        await watching.socket.point(.unbound, at: "P1")
        for _ in 1 ... 20 {
            await Task.yield()
        }

        #expect(await watching.watch.openCount() == 0)
        #expect(await watching.derivations.derived() == 0)
    }

    @Test
    func `re-pointing at the Binding it is already watching does not redial`() async {
        // A surface may call `point` on every rebuild, and a second dial per act would be a second
        // hook per act.
        let watching = Watching([.carrying(0)])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.wait.untilTick()
        await watching.socket.point(.ready(target.binding), at: "P1")
        for _ in 1 ... 20 {
            await Task.yield()
        }
        await watching.socket.stop()

        #expect(await watching.watch.openCount() == 1)
    }

    @Test
    func `the watch is opened on the Binding's own scope and grant`() async {
        let watching = Watching([.carrying(0)])

        await watching.socket.point(.ready(target.binding), at: "P1")
        await watching.wait.untilTick()
        await watching.socket.stop()

        let asked = await watching.watch.lastAsked()
        #expect(asked?.scope == "acme/api")
        #expect(asked?.token == AccountGrant.listing.accessToken)
    }
}

/// One socket, the watch behind it and the derivations it asked for — what every case in
/// `DeliverySocketTests` asserts against.
private struct Watching {
    let socket: DeliverySocket
    let watch: ScriptedCodeHostWatch
    let derivations: SocketDerivations
    let failures: SocketFailures
    let waits: PollSleeps
    let wait: PollWait

    /// `between` is how long the fake sleeper waits AFTER announcing the backoff. A case asserting
    /// an EXACT count passes `.held`, so the run parks after one socket rather than racing the case
    /// for the window in which to stop it.
    init(_ script: [ScriptedSocket], between reconnects: Duration = .held) {
        let watch = ScriptedCodeHostWatch(script)
        let derivations = SocketDerivations()
        let failures = SocketFailures()
        let wait = PollWait()
        let waits = PollSleeps(wait, held: reconnects)
        self.watch = watch
        self.derivations = derivations
        self.failures = failures
        self.wait = wait
        self.waits = waits
        self.socket = DeliverySocket(
            watch: watch,
            derive: derivations.derive,
            reportDialFailure: failures.reportDialFailure,
            sleep: waits.sleep,
        )
    }
}
