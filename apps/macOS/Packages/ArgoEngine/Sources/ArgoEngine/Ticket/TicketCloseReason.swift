import Foundation

/// Why a ticket was closed, which is the half of closure no provider derives.
///
/// Two cases and not `TicketClosure`'s four: `open` is not a way to close, and `closedUnreadably`
/// is something a READ discovers rather than something a caller can ask for.
public enum TicketCloseReason: String, Equatable, Sendable, CaseIterable {
    case resolved
    case ruledOut

    public var closure: TicketClosure {
        switch self {
        case .resolved: .resolved
        case .ruledOut: .ruledOut
        }
    }
}
