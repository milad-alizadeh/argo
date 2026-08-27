@testable import ArgoEngine
import Foundation
import Testing

/// Which of a Binding's four answers is worth polling on. The decision lives with the loop rather
/// than with the surface that owns the Binding, so the two cannot disagree about what an unbound
/// port means.
@Suite("Work Item pointing")
struct WorkItemPointingTests {
    private func poll(_ port: ScriptedWorkItems) -> WorkItemPoll {
        WorkItemPoll(port: port, health: ConnectionHealthLedger(), items: WorkItemLedger())
    }

    @Test
    func `a Project with no Work Item provider is read for nothing`() async {
        // Not a failure: a Project bound to no provider is a fully-onboarded state, and a loop
        // started on it would file causes against a Binding that does not exist.
        let port = ScriptedWorkItems([.success([])])

        await poll(port).point(.unbound, at: "P1")

        #expect(await port.readCount() == 0)
    }

    @Test
    func `a Binding that has come undone is not retried`() async {
        // The Connect panel repairs this. Reading into it would report a connection failing where
        // what is actually missing is a decision.
        let port = ScriptedWorkItems([.success([])])
        let undone = BindingResolution.broken(
            ProjectBinding(port: .workItem, accountID: "github:1", scope: "acme/api"),
            .grantMissing,
        )

        await poll(port).point(undone, at: "P1")

        #expect(await port.readCount() == 0)
    }

    @Test
    func `a folder the registry does not hold has no Project to key health on`() async {
        let port = ScriptedWorkItems([.success([])])

        await poll(port).point(.ready(.stub()), at: nil)

        #expect(await port.readCount() == 0)
    }

    private static let ticket = WorkItem(
        number: 12,
        title: "Port it",
        status: "open",
        closure: .open,
    )

    /// A poll whose wait is observable, so a case acts on a read that has actually landed.
    private func waiting(_ items: WorkItemLedger, _ wait: PollWait) -> WorkItemPoll {
        WorkItemPoll(
            port: ScriptedWorkItems([.success([Self.ticket])]),
            health: ConnectionHealthLedger(),
            items: items,
            sleep: { _ in await wait.reach(); try await Task.sleep(for: .seconds(600)) },
        )
    }

    @Test
    func `a bound port reads straight away rather than on the first tick`() async {
        // A room that stayed empty for the whole interval would read as a repository with no
        // issues, which is a different claim entirely.
        let items = WorkItemLedger()
        let wait = PollWait()
        let poll = waiting(items, wait)

        await poll.point(.ready(.stub()), at: "P1")
        await wait.untilTick()
        await poll.stop()

        #expect(await items.items(of: "P1") == [Self.ticket])
    }

    @Test
    func `pointing again at the Binding already being read costs no request`() async {
        // Every panel act ends in a rebuild, and `start` reads immediately — so a loop that
        // restarted on each one would spend a request per keystroke.
        let port = ScriptedWorkItems([.success([Self.ticket])])
        let wait = PollWait()
        let poll = WorkItemPoll(
            port: port,
            health: ConnectionHealthLedger(),
            items: WorkItemLedger(),
            sleep: { _ in await wait.reach(); try await Task.sleep(for: .seconds(600)) },
        )

        await poll.point(.ready(.stub()), at: "P1")
        await wait.untilTick()
        await poll.point(.ready(.stub()), at: "P1")
        await poll.stop()

        #expect(await port.readCount() == 1)
    }

    @Test
    func `an Account authorized again is read through its new token`() async {
        // The Binding is identical either side of a re-authorization and only the grant moved. A
        // loop that read that as unchanged would poll on a token the provider has stopped taking
        // for the rest of the launch.
        let port = ScriptedWorkItems([.success([Self.ticket])])
        let wait = PollWait()
        let poll = WorkItemPoll(
            port: port,
            health: ConnectionHealthLedger(),
            items: WorkItemLedger(),
            sleep: { _ in await wait.reach(); try await Task.sleep(for: .seconds(600)) },
        )

        await poll.point(.ready(.stub()), at: "P1")
        await wait.untilTick()
        await poll.point(.ready(.stub(regranted: "ghu_fresh")), at: "P1")
        await wait.untilTick()
        await poll.stop()

        #expect(await port.readCount() == 2)
    }

    @Test
    func `a port unbound after a read stops the loop and keeps what it found`() async {
        // Stopping is not forgetting: what was fetched stays an accurate DERIVED read of a scope
        // this Project no longer polls, and the room empties when a surface says so, not here.
        let items = WorkItemLedger()
        let wait = PollWait()
        let poll = waiting(items, wait)

        await poll.point(.ready(.stub()), at: "P1")
        await wait.untilTick()
        await poll.point(.unbound, at: "P1")

        #expect(await items.items(of: "P1") == [Self.ticket])
    }
}
