import Foundation

/// Why one Linear operation did not answer with what was asked for.
///
/// One failure read into two vocabularies rather than two failures: health speaks
/// `ProviderFetchError` and a write speaks `TicketWriteError`, and a read and a write that fail
/// the same way must not reach the app as two different words for it.
enum LinearFailure: Error, Equatable {
    /// Linear took the operation and refused it, in its own words. GraphQL, so this arrives as a
    /// 200 carrying `errors` and the SHAPE is what says so — never the status code.
    case refused(String)
    /// Linear answered with neither the payload nor a refusal, so nothing was established.
    case unreadable
    /// The operation never reached Linear, or its answer was not an answer.
    case reached(ProviderFetchError)

    static func sending(_ error: Error) -> LinearFailure {
        .reached(.reading(error))
    }

    /// The health ledger's word. A refusal reaches it as `unreachable` because this READ
    /// established nothing — not because the connection is suspect.
    var fetchError: ProviderFetchError {
        switch self {
        case .refused, .unreadable: .unreachable
        case let .reached(error): error
        }
    }

    /// The writer's word. A refusal stays verbatim: the provider answered, and its sentence is
    /// the only thing that tells a missing scope from an illegal edit.
    var writeError: TicketWriteError {
        switch self {
        case let .refused(reason): .refused(reason)
        case .unreadable: .unreachable(.unreachable)
        case let .reached(error): .unreachable(error)
        }
    }
}
