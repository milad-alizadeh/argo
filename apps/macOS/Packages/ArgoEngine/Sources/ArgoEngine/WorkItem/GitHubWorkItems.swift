import Foundation

/// The Work Item port filled by GitHub Issues, read through one Binding's grant.
///
/// Sibling to `GitHubWorkItemTitles`, which answers one number. This one enumerates, which is the
/// read a Work room and a poll are built on.
public struct GitHubWorkItems: WorkItemPort {
    let reads: GitHubReads

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.reads = GitHubReads(transport: transport)
    }

    public func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem] {
        // Open only. A closed ticket has left the room, and asking for every issue a repository
        // ever had costs a poll two extra requests per issue on edges nobody is waiting on. The
        // closures that DO matter travel on the blocker edges, which carry their own.
        let issues: [GitHubIssue] = try await reads.pages(
            [GitHubIssue].self, of: "/repos/\(scope)/issues?state=open", grant: grant,
        )
        var items: [WorkItem] = []
        for issue in issues where issue.pullRequest == nil {
            try await items.append(workItem(issue, in: scope, grant: grant))
        }
        return items
    }

    /// The edges, asked for only where the issue's own summary says there is one. The summaries
    /// carry counts and never numbers, so they answer "is there an edge" and never "which".
    private func workItem(
        _ issue: GitHubIssue, in scope: String, grant: AccountGrant,
    ) async throws
        -> WorkItem {
        let path = "/repos/\(scope)/issues/\(issue.number)"
        let children: [GitHubIssue] = issue.hasChildren
            ? try await reads.pages([GitHubIssue].self, of: "\(path)/sub_issues", grant: grant)
            : []
        let blockers: [GitHubIssue] = issue.hasBlockers
            ? try await reads.pages(
                [GitHubIssue].self, of: "\(path)/dependencies/blocked_by", grant: grant,
            )
            : []
        return issue.workItem(
            children: children.map(\.number),
            // A host that served no summary served no edges either, and that is `nil` rather than
            // the empty list a host with none of them answers with.
            blockedBy: issue.issueDependenciesSummary == nil
                ? nil
                : blockers.map { WorkItemBlocker(number: $0.number, closure: $0.closure) },
        )
    }
}
