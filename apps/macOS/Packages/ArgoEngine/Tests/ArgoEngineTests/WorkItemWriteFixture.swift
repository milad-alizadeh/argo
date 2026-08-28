@testable import ArgoEngine
import Foundation

/// A workflow-capable Work Item provider, as a SECOND conformant of the write port.
///
/// Not a mock of GitHub — it is the other thing the port claims to fit. Two things only it can
/// exercise: a transition that is legal to want and illegal to make, which GitHub has none of
/// because open and closed reach each other from anywhere; and a provider whose capability gap is
/// somewhere else, so the conformance claims are about the port rather than about GitHub.
actor WorkflowTracker: WorkItemWriting {
    nonisolated let surface = WorkItemSurface(
        writes: [.create, .updateFields, .transition, .labels, .priority, .closure],
        states: [.todo, .inProgress, .done, .closed],
    )

    private var held: [Int: WorkItem] = [:]
    private var positions: [Int: WorkItemCanonicalState] = [:]
    private var next = 100

    /// The order work moves in: forward one rung at a time, or back to `todo` from anywhere, or out
    /// to `closed`.
    private static let ladder: [WorkItemCanonicalState] = [.todo, .inProgress, .done]

    init(holding items: [WorkItem] = []) {
        for item in items {
            held[item.number] = item
            positions[item.number] = .todo
        }
    }

    func create(_ draft: WorkItemDraft, through _: ResolvedBinding) async throws -> WorkItem {
        next += 1
        let filed = WorkItem(number: next, title: draft.title, status: "todo", closure: .open)
        held[next] = filed
        positions[next] = .todo
        return filed
    }

    func apply(
        _ intent: WorkItemIntent, to number: Int, through _: ResolvedBinding,
    ) async throws
        -> WorkItem {
        guard surface.offers(intent.write) else {
            throw WorkItemWriteError.unavailable(intent.write)
        }
        guard let item = held[number] else {
            throw WorkItemWriteError.refused("No issue \(number)")
        }
        let written = try applied(intent, to: item)
        held[number] = written
        return written
    }

    /// Every declared write actually moves something here: one that quietly changed nothing would
    /// make the conformance suite's "declared writes are taken" claim pass no matter what.
    private func applied(_ intent: WorkItemIntent, to item: WorkItem) throws -> WorkItem {
        switch intent {
        case let .updateFields(fields):
            return WorkItem(copying: item, title: fields.title)
        case let .transitionTo(state):
            try transition(item.number, to: state)
            return WorkItem(copying: item, status: state.rawValue)
        case let .setPriority(word):
            return WorkItem(copying: item, priority: word)
        case let .addLabel(label):
            return WorkItem(copying: item, labels: item.labels + [label])
        case let .removeLabel(label):
            return WorkItem(copying: item, labels: item.labels.filter { $0 != label })
        case let .close(reason):
            try transition(item.number, to: .closed)
            return WorkItem(copying: item, status: "closed", closure: reason.closure)
        case .reopen:
            try transition(item.number, to: .todo)
            return WorkItem(copying: item, status: "todo", closure: .open)
        case .addBlockedBy, .removeBlockedBy, .setParent, .removeParent:
            throw WorkItemWriteError.unavailable(intent.write)
        }
    }

    private func transition(_ number: Int, to state: WorkItemCanonicalState) throws {
        guard surface.states.contains(state) else {
            throw WorkItemWriteError.inexpressible(state)
        }
        let from = positions[number] ?? .todo
        guard Self.reaches(from, state) else {
            throw WorkItemWriteError.illegalTransition(from: from, to: state)
        }
        positions[number] = state
    }

    private static func reaches(
        _ from: WorkItemCanonicalState, _ target: WorkItemCanonicalState,
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
