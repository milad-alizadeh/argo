import Foundation

/// One Ticket write, applied through the port and adopted into the listing the room draws from.
///
/// The write-side twin of `TicketPoll`: health is keyed on the Binding rather than on what was
/// done through it (#260), so both provider acts record it from one place.
///
/// **Nothing here retries.** Re-sending a `transitionTo` risks double-applying against a provider
/// whose transition legality is per-workflow, and re-sending a create files the ticket twice.
public actor TicketWriter {
    private let port: TicketWriting
    private let items: TicketLedger
    private let health: ConnectionHealthLedger
    private let now: @Sendable () -> Date

    public init(
        port: TicketWriting,
        items: TicketLedger,
        health: ConnectionHealthLedger,
        now: @escaping @Sendable () -> Date = Date.init,
    ) {
        self.port = port
        self.items = items
        self.health = health
        self.now = now
    }

    /// What this adapter can be asked for, read before a control is drawn.
    public var surface: TicketSurface {
        port.surface
    }

    public func create(
        _ draft: TicketDraft, on target: PortReadTarget,
    ) async throws
        -> Ticket {
        try await adopting(target) { try await port.create(draft, through: target.binding) }
    }

    public func apply(
        _ intent: TicketIntent, to number: Int, on target: PortReadTarget,
    ) async throws
        -> Ticket {
        try await adopting(target) {
            try await port.apply(intent, to: number, through: target.binding)
        }
    }

    /// Remove one ticket, and take it out of the listing the room draws from once the provider
    /// has said it is gone (#1247). Nothing is dropped on the press: a row taken off the list
    /// before the provider answered is a false DIRECT about somebody else's record.
    public func delete(_ number: Int, on target: PortReadTarget) async throws {
        do {
            try await port.delete(number, through: target.binding)
            await items.forget(number, for: target.projectID)
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
        } catch {
            throw await recorded(error, on: target)
        }
    }

    /// The provider's answer becomes the listing's, and the connection behind it is recorded.
    ///
    /// A refusal records nothing about health: a provider that answered "no" is a provider that
    /// answered, and filing that as a broken connection would leave the chip claiming a fault a
    /// reconnect could not clear.
    private func adopting(
        _ target: PortReadTarget, _ write: () async throws -> Ticket,
    ) async throws
        -> Ticket {
        do {
            let written = try await write()
            await items.adopt(written, for: target.projectID)
            await health.succeeded(target.projectBinding, in: target.projectID, at: now())
            return written
        } catch {
            throw await recorded(error, on: target)
        }
    }

    /// A failure in the port's own vocabulary, with the connection behind it recorded.
    ///
    /// Every error is converted, not only the port's own vocabulary: a second adapter has nothing
    /// forcing it to convert, and one that threw past this would leave the chip claiming a
    /// connection nobody has checked since. Converting is not naming a health word for it: an
    /// error with none carries `nil`, and the chip is left where it was (#1698).
    private func recorded(_ error: Error, on target: PortReadTarget) async -> TicketWriteError {
        let refusal = error as? TicketWriteError
            ?? .unreachable(ProviderFetchError.refusal(error))
        await health.record(refusal.fetchFailure, of: target)
        return refusal
    }
}
