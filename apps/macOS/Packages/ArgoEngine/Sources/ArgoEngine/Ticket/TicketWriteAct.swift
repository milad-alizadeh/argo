import Foundation

/// Which Ticket write a room raised (#872, #1247, #1333). Named as a value so a surface says WHICH
/// rather than reaching a method per act: a fourth write is one case here and one row in the
/// dispatch below, where a suite can reach it — not a fourth wrapper in the app target (ADR-0022).
public enum TicketWriteAct: Sendable {
    case create(TicketDraft)
    case apply(TicketIntent, to: Int)
    case remove(Int)
}

public extension TicketCreator {
    /// One write, whichever it is: the refusal that stopped it, and `nil` where it landed. Each
    /// case's own terms are its method's, above.
    func perform(
        _ write: TicketWriteAct,
        forProject projectID: String?,
    ) async
        -> TicketWriteError? {
        switch write {
        case let .create(draft):
            await create(draft, forProject: projectID)
        case let .apply(intent, number):
            await apply(intent, to: number, forProject: projectID)
        case let .remove(number):
            await remove(number, forProject: projectID)
        }
    }
}
