import Foundation

/// Which Binding a poll reads through, and which Project it answers for.
///
/// The Project id travels with the Binding because health is keyed on both (#260): the same
/// Account bound by two Projects is two connections, and one of them can be failing.
public struct WorkItemPollTarget: Sendable {
    public let binding: ResolvedBinding
    public let projectID: String

    public init(binding: ResolvedBinding, projectID: String) {
        self.binding = binding
        self.projectID = projectID
    }
}

/// The repeating read of one Project's Work Items — a desktop app receives no webhooks, so polling
/// is the only way the room is ever right (`CONTEXT.md` → Ports).
///
/// An actor, so no read and no decode ever runs on the MainActor, and the whole loop is one
/// `Task` that `stop()` cancels: a Project closed mid-request leaves nothing running behind it.
public actor WorkItemPoll {
    public typealias Sleeper = @Sendable (Duration) async throws -> Void

    private let port: WorkItemPort
    private let health: ConnectionHealthLedger
    private let items: WorkItemLedger
    private let sleep: Sleeper
    private let now: @Sendable () -> Date
    private var loop: Task<Void, Never>?

    public init(
        port: WorkItemPort,
        health: ConnectionHealthLedger,
        items: WorkItemLedger,
        sleep: @escaping Sleeper = { try await Task.sleep(for: $0) },
        now: @escaping @Sendable () -> Date = Date.init,
    ) {
        self.port = port
        self.health = health
        self.items = items
        self.sleep = sleep
        self.now = now
    }

    /// Read now, then every `interval` until stopped. Starting again replaces the loop rather than
    /// adding one, so a Project rebound mid-run polls through its new Binding and not both.
    public func start(_ target: WorkItemPollTarget, every interval: Duration) {
        loop?.cancel()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await poll(target)
                guard await waited(interval) else { return }
            }
        }
    }

    public func stop() {
        loop?.cancel()
        loop = nil
    }

    /// One read. Public because a Work room's Refresh is the same act as a tick, and two paths to
    /// it would be two chances to record health differently.
    public func poll(_ target: WorkItemPollTarget) async {
        do {
            let listed = try await port.list(
                in: target.binding.binding.scope, grant: target.binding.grant,
            )
            await items.record(listed, for: target.projectID)
            await health.succeeded(target.binding.binding, in: target.projectID, at: now())
        } catch {
            await record(error as? WorkItemFetchError ?? .unreachable, of: target)
        }
    }

    /// The listing is deliberately untouched on every path through here — a failed read leaves
    /// what was fetched where it was, old and still accurately DERIVED.
    private func record(_ error: WorkItemFetchError, of target: WorkItemPollTarget) async {
        guard let cause = error.cause else {
            await health.grantRefused(target.binding.binding.accountID)
            return
        }
        await health.failed(target.binding.binding, in: target.projectID, cause: cause)
    }

    /// `false` once the wait was cancelled, which is the loop's only exit besides `stop()`.
    private func waited(_ interval: Duration) async -> Bool {
        await (try? sleep(interval)) != nil
    }
}
