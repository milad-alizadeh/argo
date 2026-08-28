import Foundation

/// One Work Item write, applied through the port and adopted into the listing the room draws from.
///
/// The write-side twin of `WorkItemPoll`: health is keyed on the Binding rather than on what was
/// done through it (#260), so both provider acts record it from one place.
///
/// **Nothing here retries.** Re-sending a `transitionTo` risks double-applying against a provider
/// whose transition legality is per-workflow, and re-sending a create files the ticket twice.
public actor WorkItemWriter {
    private let port: WorkItemWriting
    private let items: WorkItemLedger
    private let health: ConnectionHealthLedger
    private let now: @Sendable () -> Date

    public init(
        port: WorkItemWriting,
        items: WorkItemLedger,
        health: ConnectionHealthLedger,
        now: @escaping @Sendable () -> Date = Date.init,
    ) {
        self.port = port
        self.items = items
        self.health = health
        self.now = now
    }

    /// What this adapter can be asked for, read before a control is drawn.
    public var surface: WorkItemSurface {
        port.surface
    }

    public func create(
        _ draft: WorkItemDraft, on target: PortReadTarget,
    ) async throws
        -> WorkItem {
        try await adopting(target) { try await port.create(draft, through: target.binding) }
    }

    public func apply(
        _ intent: WorkItemIntent, to number: Int, on target: PortReadTarget,
    ) async throws
        -> WorkItem {
        try await adopting(target) {
            try await port.apply(intent, to: number, through: target.binding)
        }
    }

    /// The provider's answer becomes the listing's, and the connection behind it is recorded.
    ///
    /// A refusal records nothing about health: a provider that answered "no" is a provider that
    /// answered, and filing that as a broken connection would leave the chip claiming a fault a
    /// reconnect could not clear.
    private func adopting(
        _ target: PortReadTarget, _ write: () async throws -> WorkItem,
    ) async throws
        -> WorkItem {
        do {
            let written = try await write()
            await items.adopt(written, for: target.projectID)
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
            return written
        } catch {
            // Every error, not only the port's own vocabulary: a second adapter has nothing
            // forcing it to convert, and one that threw past this would leave the chip claiming a
            // connection nobody has checked since.
            let refusal = error as? WorkItemWriteError
                ?? .unreachable(error as? ProviderFetchError ?? .unreachable)
            if let failure = refusal.fetchFailure {
                await health.record(failure, of: target)
            }
            throw refusal
        }
    }
}
