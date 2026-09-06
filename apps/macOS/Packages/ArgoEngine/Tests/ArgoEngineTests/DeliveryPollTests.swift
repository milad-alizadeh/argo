@testable import ArgoEngine
import Testing

/// The repeating derivation, and what pointing it at a Binding does — the loop only. What one
/// derivation LANDS is `DeliveryDerivationTests`', and the health it files is
/// `DeliveryHealthTests`'.
@Suite("Delivery poll")
struct DeliveryPollTests {
    private let target = PortReadTarget.codeHost()
    private let delivery = Delivery(branch: "ticket-1480", pullRequest: .stub(number: 7))

    /// One poll, the host behind it and the ledger it fills — what every case here asserts against.
    private struct Polling {
        let poll: DeliveryPoll
        let host: ScriptedCodeHost
        let ledger: DeliveryLedger
        let wait: PollWait

        init(_ host: ScriptedCodeHost, workspaces: [WorkspaceProjection] = []) {
            let ledger = DeliveryLedger()
            let wait = PollWait()
            self.host = host
            self.ledger = ledger
            self.wait = wait
            self.poll = DeliveryPoll(
                derivation: DeliveryDerivation(
                    port: host, health: ConnectionHealthLedger(), deliveries: ledger,
                ),
                locally: { DeliveryDerivation.Locally(workspaces: workspaces) },
                sleep: { _ in await wait.reach(); try await Task.sleep(for: .milliseconds(1)) },
            )
        }

        /// Wait out `count` ticks, then leave nothing running.
        func settle(ticks count: Int) async {
            for _ in 1 ... count {
                await wait.untilTick()
            }
            await poll.stop()
        }
    }

    @Test
    func `a pointed poll derives again on every tick`() async {
        let polling = Polling(ScriptedCodeHost([.success([delivery])]))

        await polling.poll.point(.ready(target.binding), at: "P1")
        await polling.settle(ticks: 3)

        #expect(await polling.host.readCount() >= 3)
        #expect(await polling.ledger.deliveries(of: "P1") == [delivery])
    }

    @Test
    func `a Project with no code host Binding derives nothing at all`() async {
        // Nothing is invented for an unread Project: the ledger stays empty, and the row draws no
        // pull request rather than one nobody asked the host about.
        let polling = Polling(ScriptedCodeHost([.success([delivery])]))

        await polling.poll.point(.unbound, at: "P1")
        for _ in 1 ... 20 {
            await Task.yield()
        }

        #expect(await polling.host.readCount() == 0)
        #expect(await polling.ledger.deliveries(of: "P1").isEmpty)
    }

    @Test
    func `a Project that closed leaves no loop behind it`() async {
        let polling = Polling(ScriptedCodeHost([.success([delivery])]))

        await polling.poll.point(.ready(target.binding), at: "P1")
        await polling.wait.untilTick()
        await polling.poll.point(.unbound, at: nil)
        for _ in 1 ... 20 {
            await Task.yield()
        }

        // One read, and nothing left running to make a second. The Deliveries it landed stay where
        // they are: a Project closing is not the host saying the pull request went away.
        #expect(await polling.host.readCount() == 1)
        #expect(await polling.ledger.deliveries(of: "P1") == [delivery])
    }

    @Test
    func `the branches are asked for on every tick rather than captured once`() async {
        // A worktree created while the loop runs has to reach the next derivation. A local half
        // taken when the Project opened would leave its row without a pull request until a rebind.
        let branches = Branches()
        let host = ScriptedCodeHost([.success([])], byBranch: ["ticket-1480": delivery])
        let poll = DeliveryPoll(
            derivation: DeliveryDerivation(
                port: host, health: ConnectionHealthLedger(), deliveries: DeliveryLedger(),
            ),
            locally: { await branches.read() },
            sleep: { _ in try await Task.sleep(for: .milliseconds(1)) },
        )

        await poll.point(.ready(target.binding), at: "P1")
        await branches.untilReadTwice()
        await poll.stop()

        #expect(await branches.reads() >= 2)
    }

    @Test
    func `pointing raises the landing even where nothing moved`() async {
        // A rebind moves which set the reader should be holding without a tick having happened.
        let landings = DeliveryLandings()
        let polling = Polling(ScriptedCodeHost([.success([delivery])]))

        await polling.poll.report(to: landings.raise)
        await polling.poll.point(.unbound, at: nil)
        await polling.poll.point(.unbound, at: nil)

        #expect(await landings.raised() == 2)
    }

    /// The local half, asked for rather than held — and counted, so a captured one fails here.
    private actor Branches {
        private var count = 0
        private var waiters: [CheckedContinuation<Void, Never>] = []

        func read() -> DeliveryDerivation.Locally {
            count += 1
            for waiter in waiters {
                waiter.resume()
            }
            waiters = []
            return DeliveryDerivation.Locally(workspaces: [.on("ticket-1480")])
        }

        func reads() -> Int {
            count
        }

        func untilReadTwice() async {
            while count < 2 {
                await withCheckedContinuation { waiters.append($0) }
            }
        }
    }
}
