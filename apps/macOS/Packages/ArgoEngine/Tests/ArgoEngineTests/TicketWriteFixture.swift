@testable import ArgoEngine
import Foundation

/// A workflow-capable Ticket provider, as a SECOND conformant of the write port.
///
/// Not a mock of GitHub — it is the other thing the port claims to fit. Two things only it can
/// exercise: a transition that is legal to want and illegal to make, which GitHub has none of
/// because open and closed reach each other from anywhere; and a provider whose capability gap is
/// somewhere else, so the conformance claims are about the port rather than about GitHub.
actor WorkflowTracker: TicketWriting {
    nonisolated let surface = TicketSurface(
        writes: [.create, .updateFields, .transition, .labels, .priority, .closure],
        states: [.todo, .inProgress, .done, .closed],
    )

    private var held: [Int: Ticket] = [:]
    private var positions: [Int: TicketCanonicalState] = [:]
    private var next = 100

    /// The order work moves in: forward one rung at a time, or back to `todo` from anywhere, or out
    /// to `closed`.
    private static let ladder: [TicketCanonicalState] = [.todo, .inProgress, .done]

    init(holding items: [Ticket] = []) {
        for item in items {
            held[item.number] = item
            positions[item.number] = .todo
        }
    }

    func create(_ draft: TicketDraft, through _: ResolvedBinding) async throws -> Ticket {
        next += 1
        let filed = Ticket(number: next, title: draft.title, status: "todo", closure: .open)
        held[next] = filed
        positions[next] = .todo
        return filed
    }

    func apply(
        _ intent: TicketIntent, to number: Int, through _: ResolvedBinding,
    ) async throws
        -> Ticket {
        guard surface.offers(intent.write) else {
            throw TicketWriteError.unavailable(intent.write)
        }
        guard let item = held[number] else {
            throw TicketWriteError.refused("No issue \(number)")
        }
        let written = try applied(intent, to: item)
        held[number] = written
        return written
    }

    /// Every declared write actually moves something here: one that quietly changed nothing would
    /// make the conformance suite's "declared writes are taken" claim pass no matter what.
    private func applied(_ intent: TicketIntent, to item: Ticket) throws -> Ticket {
        switch intent {
        case let .updateFields(fields):
            return Ticket(copying: item, title: fields.title)
        case let .transitionTo(state):
            try transition(item.number, to: state)
            return Ticket(copying: item, status: state.rawValue)
        case let .setPriority(word):
            return Ticket(copying: item, priority: word)
        case let .addLabel(label):
            return Ticket(copying: item, labels: item.labels + [TicketLabel(name: label)])
        case let .removeLabel(label):
            return Ticket(copying: item, labels: item.labels.filter { $0.name != label })
        case let .close(reason):
            try transition(item.number, to: .closed)
            return Ticket(copying: item, status: "closed", closure: reason.closure)
        case .reopen:
            try transition(item.number, to: .todo)
            return Ticket(copying: item, status: "todo", closure: .open)
        case .addBlockedBy, .removeBlockedBy, .setParent, .removeParent:
            throw TicketWriteError.unavailable(intent.write)
        }
    }

    private func transition(_ number: Int, to state: TicketCanonicalState) throws {
        guard surface.states.contains(state) else {
            throw TicketWriteError.inexpressible(state)
        }
        let from = positions[number] ?? .todo
        guard Self.reaches(from, state) else {
            throw TicketWriteError.illegalTransition(from: from, to: state)
        }
        positions[number] = state
    }

    private static func reaches(
        _ from: TicketCanonicalState, _ target: TicketCanonicalState,
    )
        -> Bool {
        guard target != .todo, target != .closed else { return true }
        guard let start = ladder.firstIndex(of: from),
              let end = ladder.firstIndex(of: target)
        else {
            return false
        }
        return end == start + 1
    }
}
