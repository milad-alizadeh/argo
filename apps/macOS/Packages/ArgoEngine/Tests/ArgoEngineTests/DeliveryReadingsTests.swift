@testable import ArgoEngine
import Testing

/// The box the window holds (#1480): what it publishes, which Project it publishes for, and where
/// the branches behind one derivation come from. The loop itself is `DeliveryPollTests`'.
///
/// Bounded for that suite's reason — every wait here is for a tick the loop is meant to raise.
@MainActor
@Suite("Delivery readings", .timeLimit(.minutes(1)))
struct DeliveryReadingsTests {
    private let delivery = Delivery(branch: "ticket-1480", pullRequest: .stub(number: 7))
    private let target = PortReadTarget.codeHost()

    @Test
    func `the box publishes what the derivation landed for the Project it points at`() async {
        let readings = Readings(ScriptedCodeHost([.success([delivery])]))

        await readings.box.point(.ready(target.binding), at: "P1")

        #expect(await readings.published() == [delivery])
    }

    /// The local half is the injected one, asked for at the tick: this host has NOTHING in flight
    /// and holds the pull request by branch alone, so the reading exists only if the Workspaces
    /// reached the derivation.
    @Test
    func `the branches the box is wired to reach the derivation`() async {
        let readings = Readings(
            ScriptedCodeHost([.success([])], byBranch: ["ticket-1480": delivery]),
        )
        readings.box.workspaces = { [.on("ticket-1480")] }

        await readings.box.point(.ready(target.binding), at: "P1")

        #expect(await readings.published() == [delivery])
    }

    @Test
    func `a Project with no code host Binding publishes nothing`() async {
        // The row draws no pull request rather than one nobody asked the host about.
        let readings = Readings(ScriptedCodeHost([.success([delivery])]))

        await readings.box.point(.unbound, at: "P1")

        #expect(readings.box.deliveries.isEmpty)
    }

    /// Switching Projects publishes the NEW one's set, which is empty until something derives for
    /// it — never the previous Project's Deliveries under another Project's rows.
    @Test
    func `moving to a Project nothing has derived for publishes empty`() async {
        let readings = Readings(ScriptedCodeHost([.success([delivery])]))

        await readings.box.point(.ready(target.binding), at: "P1")
        _ = await readings.published()
        await readings.box.point(.unbound, at: "P2")

        #expect(readings.box.deliveries.isEmpty)
    }

    /// One box over a scripted host, paced by a fake sleeper — the two seams the box exposes.
    @MainActor
    private struct Readings {
        let box: DeliveryReadings

        init(_ host: ScriptedCodeHost) {
            self.box = DeliveryReadings(
                health: ConnectionHealthLedger(),
                port: host,
                sleep: PollSleeps(PollWait(), held: .milliseconds(1)).sleep,
            )
        }

        /// What the box holds once a derivation has landed. Bounded, so a box that never publishes
        /// fails on the answer rather than waiting the suite out.
        func published() async -> [Delivery] {
            for _ in 1 ... 200 where box.deliveries.isEmpty {
                await Task.yield()
            }
            return box.deliveries
        }
    }
}
