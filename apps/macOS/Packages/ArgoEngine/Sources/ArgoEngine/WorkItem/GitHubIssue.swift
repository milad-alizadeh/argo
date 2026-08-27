import Foundation

/// One issue as GitHub's REST API serves it, parsed at the boundary and nowhere else.
///
/// The two summaries carry counts and no numbers, so they answer "is there an edge here at all"
/// and never which. `totalBlockedBy` rather than `blockedBy`: the latter counts OPEN blockers
/// only, and a cancelled blocker is exactly the edge Argo must still see.
struct GitHubIssue: Decodable {
    let number: Int
    let title: String
    let state: String
    let stateReason: String?
    let labels: [Label]
    let assignees: [User]
    /// GitHub's own issue type, absent on a repository that has not turned them on — which reads
    /// the same as an untyped issue, because from a surface's side it is: no type word to draw.
    let type: IssueType?
    /// The Markdown the ticket was filed with. Absent and blank are one state here, since neither
    /// is a body anything could render.
    let body: String?
    /// GitHub serves pull requests from `/issues` too, and this is the only field telling them
    /// apart. A pull request is a Delivery (`CONTEXT.md` L4), never a Work Item.
    let pullRequest: PullRequestMark?
    let subIssuesSummary: SubIssuesSummary?
    let issueDependenciesSummary: DependenciesSummary?

    struct Label: Decodable { let name: String }
    struct User: Decodable { let login: String }
    struct IssueType: Decodable { let name: String }
    struct PullRequestMark: Decodable { let url: String }
    struct SubIssuesSummary: Decodable { let total: Int }
    struct DependenciesSummary: Decodable { let totalBlockedBy: Int }

    var hasChildren: Bool {
        (subIssuesSummary?.total ?? 0) > 0
    }

    var hasBlockers: Bool {
        (issueDependenciesSummary?.totalBlockedBy ?? 0) > 0
    }

    /// Whether this issue was served a dependency summary at all. Its ABSENCE is what says the host
    /// does not expose dependency edges: a zero count is an answer, and no field is a silence
    /// (`CONTEXT.md` L2 · degrade-down).
    var blockersRead: Bool {
        issueDependenciesSummary != nil
    }

    /// GitHub's closure kinds, verbatim. `duplicate` and `not_planned` are both cancellations;
    /// `completed` is the only one that says the work was done. A closed issue with no reason at
    /// all predates the field and cannot be told apart, which is what `closedUnreadably` is for.
    var closure: WorkItemClosure {
        guard state != "open" else { return .open }
        switch stateReason {
        case "completed": return .resolved
        case "not_planned", "duplicate": return .ruledOut
        default: return .closedUnreadably
        }
    }

    /// The ticket without its edges — everything one listing request already answered.
    func workItem(children: [Int], blockedBy: [WorkItemBlocker]) -> WorkItem {
        let prose = body?.trimmingCharacters(in: .whitespacesAndNewlines)
        return WorkItem(
            number: number,
            title: title,
            status: state,
            closure: closure,
            assignees: assignees.map(\.login),
            labels: labels.map(\.name),
            priority: priority,
            type: type?.name,
            children: children,
            blockedBy: blockedBy,
            blockersRead: blockersRead,
            body: prose?.isEmpty == true ? nil : prose,
        )
    }
}
