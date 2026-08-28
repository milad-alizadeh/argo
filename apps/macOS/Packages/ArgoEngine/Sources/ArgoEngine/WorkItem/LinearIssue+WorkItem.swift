import Foundation

/// The issue as a Work Item — the one place Linear's shape becomes Argo's.
extension LinearIssue {
    /// Linear's word for "nobody ranked this". It is a label rather than an absence on the wire,
    /// and rendering it as a priority would put every unranked ticket in a band of its own.
    private static let unranked = "No priority"

    func workItem() -> WorkItem {
        WorkItem(
            number: number,
            // The team's own word for the column, verbatim — never the category behind it (#272).
            title: title,
            status: state.name,
            closure: state.category.closure,
            assignees: assignee.map { [$0.displayName] } ?? [],
            labels: labels.nodes.map(\.name),
            priority: priority,
            // Linear carries no issue TYPE. Absent rather than filled from the project or the
            // milestone, neither of which is what the word means (#160).
            type: nil,
            children: children.nodes.map(\.number),
            blockedBy: blockers,
            body: prose,
            updatedAt: LinearAPI.timestamp(updatedAt),
        )
    }

    private var priority: String? {
        guard let priorityLabel, priorityLabel != Self.unranked else { return nil }
        return priorityLabel
    }

    /// Never `nil`. Linear serves the relations with the issue, so an empty list is the provider
    /// SAYING there is nothing in the way — the answer GitHub's dependency summary cannot give
    /// (`CONTEXT.md` L2 · degrade-down).
    private var blockers: [WorkItemBlocker] {
        inverseRelations.nodes
            .filter { $0.type == "blocks" }
            .map {
                WorkItemBlocker(number: $0.issue.number, closure: $0.issue.state.category.closure)
            }
    }

    private var prose: String? {
        let trimmed = description?.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed?.isEmpty == true ? nil : trimmed
    }
}
