import Foundation

/// Which operation Linear takes for each canonical intent — how "the adapter resolves it to the
/// provider's native mechanism" is spelled here (#167).
extension LinearTickets {
    /// The one relation type Argo reads. Linear also serves `duplicate`, `related` and `similar`,
    /// none of which is a dependency edge.
    static let blocks = "blocks"

    func operation(
        for intent: TicketIntent, on id: String, through binding: ResolvedBinding,
    ) async throws
        -> LinearOperation {
        switch intent {
        case let .updateFields(fields):
            return Self.update(id, Self.edited(fields))
        case let .transitionTo(state):
            return try await moving(to: state, on: id, through: binding)
        case let .close(reason):
            return try await moving(to: reason.canonical, on: id, through: binding)
        case .reopen:
            return try await moving(to: .todo, on: id, through: binding)
        case let .setPriority(word):
            return try Self.update(id, ["priority": .int(LinearPriority.rung(word))])
        case let .setParent(parent):
            let uuid = try await identifier(of: parent, through: binding)
            return Self.update(id, ["parentId": .string(uuid)])
        case .removeParent:
            // The parent the caller named is not sent: Linear holds one parent per issue, so
            // clearing it needs no far end to address.
            return Self.update(id, ["parentId": .null])
        case let .addLabel(name):
            let label = try await labelID(named: name, through: binding)
            return Self.labelling(LinearDocuments.addLabel, id, label)
        case let .removeLabel(name):
            let label = try await labelID(named: name, through: binding)
            return Self.labelling(LinearDocuments.removeLabel, id, label)
        case let .addBlockedBy(blocker):
            return try await relating(blocker, to: id, through: binding)
        case let .removeBlockedBy(blocker):
            let relation = try await relationID(blocking: blocker, on: id, through: binding)
            return LinearOperation(LinearDocuments.relationDelete, ["id": .string(relation)])
        }
    }

    private func moving(
        to state: TicketCanonicalState, on id: String, through binding: ResolvedBinding,
    ) async throws
        -> LinearOperation {
        let column = try await stateID(for: state, through: binding)
        return Self.update(id, ["stateId": .string(column)])
    }

    /// The edge points FROM the blocker: a Linear relation reads `issue blocks relatedIssue`, so
    /// the subject of this write is the far end of the relation being filed.
    private func relating(
        _ blocker: Int, to id: String, through binding: ResolvedBinding,
    ) async throws
        -> LinearOperation {
        let blocking = try await identifier(of: blocker, through: binding)
        return LinearOperation(LinearDocuments.relationCreate, ["input": .object([
            "issueId": .string(blocking),
            "relatedIssueId": .string(id),
            "type": .string(Self.blocks),
        ])])
    }

    private static func labelling(
        _ document: String, _ id: String, _ label: String,
    )
        -> LinearOperation {
        LinearOperation(document, ["id": .string(id), "label": .string(label)])
    }

    private static func update(
        _ id: String, _ input: [String: LinearValue],
    )
        -> LinearOperation {
        LinearOperation(LinearDocuments.issueUpdate, ["id": .string(id), "input": .object(input)])
    }

    /// The prose, and only the halves the edit actually names — `nil` there means "leave it
    /// alone", and sending it as null would clear a body nobody asked to clear.
    private static func edited(_ fields: TicketFields) -> [String: LinearValue] {
        var input: [String: LinearValue] = [:]
        if let title = fields.title {
            input["title"] = .string(title)
        }
        if let body = fields.body {
            input["description"] = .string(body)
        }
        return input
    }
}

extension TicketCloseReason {
    /// Linear has a category for each of the two reasons, so a closure survives the write: a
    /// ruled-out ticket lands in `canceled` rather than collapsing into the one closed column.
    var canonical: TicketCanonicalState {
        switch self {
        case .resolved: .done
        case .ruledOut: .closed
        }
    }
}
