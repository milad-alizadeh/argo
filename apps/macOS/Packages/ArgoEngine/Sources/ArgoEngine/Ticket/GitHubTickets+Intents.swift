import Foundation

/// Which request GitHub takes for each canonical intent — how "the adapter resolves it to the
/// provider's native mechanism" is spelled here (#167).
extension GitHubTickets {
    func path(of number: Int, through binding: ResolvedBinding) -> String {
        "/repos/\(binding.binding.scope)/issues/\(number)"
    }

    func request(
        _ intent: TicketIntent, to number: Int, through binding: ResolvedBinding,
    ) async throws
        -> GitHubWriteRequest {
        if let fields = Self.edited(intent) {
            return try .patch(path(of: number, through: binding), fields)
        }
        return try await edge(intent, to: number, through: binding)
    }

    /// The intents GitHub takes as one edit of the issue itself, which is also the only reply worth
    /// adopting straight.
    private static func edited(_ intent: TicketIntent) -> [String: Any]? {
        switch intent {
        case let .updateFields(fields):
            var edit: [String: Any] = [:]
            if let title = fields.title {
                edit["title"] = title
            }
            if let body = fields.body {
                edit["body"] = body
            }
            return edit
        case let .transitionTo(state):
            return state.gitHubEdit
        case let .close(reason):
            return ["state": "closed", "state_reason": reason.gitHubReason]
        case .reopen:
            // An issue reopened without one keeps the `state_reason` it was closed with, and would
            // read back as ruled out while sitting open.
            return ["state": "open", "state_reason": "reopened"]
        case .addBlockedBy, .removeBlockedBy, .setParent, .removeParent,
             .addLabel, .removeLabel, .setPriority:
            return nil
        }
    }

    /// The intents GitHub takes on their own endpoints.
    ///
    /// Every edge one names the ticket at the FAR end by its database id, and every number Argo
    /// holds is the issue number a human reads — so an edge write costs one read to address before
    /// it can be sent.
    private func edge(
        _ intent: TicketIntent, to number: Int, through binding: ResolvedBinding,
    ) async throws
        -> GitHubWriteRequest {
        let issue = path(of: number, through: binding)
        switch intent {
        case let .addLabel(label):
            return try .post("\(issue)/labels", ["labels": [label]])
        case let .removeLabel(label):
            return try .delete("\(issue)/labels/\(Self.escaped(label))")
        case let .addBlockedBy(blocker):
            let blocking = try await identifier(of: blocker, through: binding)
            return try .post("\(issue)/dependencies/blocked_by", ["issue_id": blocking])
        case let .removeBlockedBy(blocker):
            let blocking = try await identifier(of: blocker, through: binding)
            return try .delete("\(issue)/dependencies/blocked_by/\(blocking)")
        case let .setParent(parent):
            return try await parenting(number, under: parent, through: binding)
        case let .removeParent(parent):
            let child = try await identifier(of: number, through: binding)
            return try .delete(
                "\(path(of: parent, through: binding))/sub_issue", ["sub_issue_id": child],
            )
        case .updateFields, .transitionTo, .close, .reopen, .setPriority:
            throw TicketWriteError.unavailable(intent.write)
        }
    }

    /// Both sub-issue endpoints hang off the PARENT and name the child, which is the opposite way
    /// round from every other intent here.
    ///
    /// `replace_parent` because re-parenting is the common act and GitHub refuses a sub-issue that
    /// already has a different parent without it — and this port has no retry to recover with.
    private func parenting(
        _ number: Int, under parent: Int, through binding: ResolvedBinding,
    ) async throws
        -> GitHubWriteRequest {
        let child = try await identifier(of: number, through: binding)
        return try .post(
            "\(path(of: parent, through: binding))/sub_issues",
            ["sub_issue_id": child, "replace_parent": true],
        )
    }

    /// The database id behind one issue number, which is the only thing GitHub's edge endpoints
    /// take.
    func identifier(of number: Int, through binding: ResolvedBinding) async throws -> Int {
        let issue: GitHubIssue = try await writes.read(
            path(of: number, through: binding), grant: binding.grant,
        )
        return issue.id
    }

    /// A label name goes in the PATH, and GitHub's labels carry spaces and slashes routinely.
    static func escaped(_ label: String) -> String {
        label.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? label
    }
}

private extension TicketCanonicalState {
    /// The open-and-closed pair a bare tracker resolves a canonical state to, and `nil` for the two
    /// GitHub cannot express — which `apply` has already refused by the time this is asked.
    var gitHubEdit: [String: Any]? {
        switch self {
        case .todo: ["state": "open", "state_reason": "reopened"]
        case .done: ["state": "closed", "state_reason": "completed"]
        case .closed: ["state": "closed", "state_reason": "not_planned"]
        case .inProgress, .inReview: nil
        }
    }
}

private extension TicketCloseReason {
    /// GitHub's third closing word, `duplicate`, is a ruling-out too and is not offered separately:
    /// Argo reads both back as `ruledOut`, so a caller choosing between them would be choosing
    /// between two spellings of one answer.
    var gitHubReason: String {
        switch self {
        case .resolved: "completed"
        case .ruledOut: "not_planned"
        }
    }
}
