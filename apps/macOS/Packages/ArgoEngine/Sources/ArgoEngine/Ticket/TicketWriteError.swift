import Foundation

/// Why a Ticket write did not land, in the caller's own vocabulary.
///
/// Its own type rather than `ProviderFetchError`, which is the HEALTH vocabulary: a write fails two
/// ways a read cannot — refused before the wire, or refused by the provider in its own words.
public enum TicketWriteError: Error, Equatable {
    /// The adapter does not perform this write at all, so nothing was asked.
    case unavailable(TicketWrite)

    /// The canonical state cannot be expressed by this provider, whatever the ticket is doing.
    case inexpressible(TicketCanonicalState)

    /// The provider CAN express the state but will not move to it from where the ticket is —
    /// Jira's workflow refusing a transition it has no edge for. Refused rather than routed through
    /// some other state, which would apply a change nobody asked for.
    case illegalTransition(from: TicketCanonicalState, to: TicketCanonicalState)

    /// The provider took the request and refused it, in its own words, held verbatim.
    case refused(String)

    /// The write never reached the provider, or its answer could not be read.
    case unreachable(ProviderFetchError)

    /// The connection-level cause, for the caller recording health, and `nil` for the refusals that
    /// say nothing about the connection: a provider that answered "no" is a provider that answered.
    public var fetchFailure: ProviderFetchError? {
        guard case let .unreachable(error) = self else { return nil }
        return error
    }
}
