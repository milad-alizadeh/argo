import Foundation

/// Why a ticket was closed, which is the half of closure no provider derives.
///
/// Two cases and not `WorkItemClosure`'s four: `open` is not a way to close, and `closedUnreadably`
/// is something a READ discovers rather than something a caller can ask for.
public enum WorkItemCloseReason: String, Equatable, Sendable, CaseIterable {
    case resolved
    case ruledOut

    public var closure: WorkItemClosure {
        switch self {
        case .resolved: .resolved
        case .ruledOut: .ruledOut
        }
    }
}
