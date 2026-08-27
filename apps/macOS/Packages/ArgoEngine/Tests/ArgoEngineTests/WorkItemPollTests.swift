@testable import ArgoEngine
import Foundation
import Testing

/// The repeating read, and what each outcome does to the two ledgers behind it — a desktop app
/// receives no webhooks, so this loop is the only reason a Work room is ever right.
@Suite("Work Item poll")
struct WorkItemPollTests {
    private let target = WorkItemPollTarget(binding: .stub(), projectID: "P1")
    private let ticket = WorkItem(
        number: 12,
        title: "Port the Work room",
        status: "open",
        closure: .open,
    )

    /// One poll and the two ledgers behind it, which is what every case here asserts against.
    private struct Polling {
        let poll: WorkItemPoll
        let health: ConnectionHealthLedger
        let items: WorkItemLedger

        init(_ port: ScriptedWorkItems) {
            let health = ConnectionHealthLedger()
            let items = WorkItemLedger()
            self.health = health
            self.items = items
            self.poll = WorkItemPoll(port: port, health: health, items: items)
        }
    }

    @Test
    func `a read that landed fills the room and reports the connection healthy`() async {
        let polling = Polling(ScriptedWorkItems([.success([ticket])]))

        await polling.poll.poll(target)

        #expect(await polling.items.items(of: "P1") == [ticket])
        #expect(await polling.health.health(of: target.binding.binding, in: "P1").state == .healthy)
    }

    @Test
    func `a read that did not land leaves the room exactly as it was`() async {
        // The failure rule this whole shape exists for: what was fetched stays where it was, old
        // and still accurately DERIVED. A poll that could blank a room would make one offline
        // moment indistinguishable from a repository with no issues.
        let polling = Polling(ScriptedWorkItems([.success([ticket]), .failure(.rateLimited)]))

        await polling.poll.poll(target)
        await polling.poll.poll(target)

        #expect(await polling.items.items(of: "P1") == [ticket])
    }

    @Test
    func `a cause that says nothing about the grant is recorded on the Binding`() async {
        let polling = Polling(ScriptedWorkItems([.failure(.rateLimited)]))

        await polling.poll.poll(target)

        let reading = await polling.health.health(of: target.binding.binding, in: "P1")
        #expect(reading.state == .stale(.rateLimited))
        #expect(reading.level == .binding)
    }

    @Test
    func `a refused grant is recorded on the Account`() async {
        // Account-level, so its blast radius is every Binding naming that identity and its remedy
        // is one act of authorizing again rather than one per Project.
        let polling = Polling(ScriptedWorkItems([.failure(.grantRefused)]))

        await polling.poll.poll(target)

        let reading = await polling.health.health(of: target.binding.binding, in: "P1")
        #expect(reading.level == .account)
    }

    @Test
    func `a read that lands again clears the failure before it`() async {
        let polling = Polling(ScriptedWorkItems([.failure(.grantRefused), .success([ticket])]))

        await polling.poll.poll(target)
        await polling.poll.poll(target)

        #expect(await polling.health.health(of: target.binding.binding, in: "P1").state == .healthy)
    }

    @Test
    func `a started poll reads again on every tick`() async {
        let wait = PollWait()
        let port = ScriptedWorkItems([.success([ticket])])
        let poll = WorkItemPoll(
            port: port, health: ConnectionHealthLedger(), items: WorkItemLedger(),
            sleep: { _ in await wait.reach(); try await Task.sleep(for: .milliseconds(1)) },
        )

        await poll.start(target, every: .milliseconds(1))
        for _ in 1 ... 3 {
            await wait.untilTick()
        }
        await poll.stop()

        #expect(await port.readCount() >= 3)
    }

    @Test
    func `stopping ends the loop where it is waiting`() async {
        let wait = PollWait()
        let port = ScriptedWorkItems([.success([ticket])])
        let poll = WorkItemPoll(
            port: port, health: ConnectionHealthLedger(), items: WorkItemLedger(),
            sleep: { _ in await wait.reach(); try await Task.sleep(for: .seconds(600)) },
        )

        await poll.start(target, every: .seconds(600))
        await wait.untilTick()
        await poll.stop()
        for _ in 1 ... 20 {
            await Task.yield()
        }

        // One read, and nothing left running to make a second — a Project closed mid-wait leaves
        // no loop behind it.
        #expect(await port.readCount() == 1)
    }
}
