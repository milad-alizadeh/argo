import Foundation

/// The Work Item port filled by GitHub Issues, read through one Binding's grant.
///
/// Sibling to `GitHubWorkItemTitles`, which answers one number. This one enumerates, which is the
/// read a Work room and a poll are built on.
public struct GitHubWorkItems: WorkItemPort {
    let transport: HTTPTransport

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.transport = transport
    }

    /// A hundred is GitHub's own ceiling for `per_page`; a short page is the last page.
    static let pageSize = 100
    /// A runaway backstop and not a working limit: `state=open` keeps a real repository inside one
    /// or two pages, and a poll that walked forever would leave the health chip claiming a read
    /// still in flight.
    static let pageLimit = 20

    public func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem] {
        var items: [WorkItem] = []
        for page in 1 ... Self.pageLimit {
            // Open only. A closed ticket has left the room, and asking for every issue a repository
            // ever had costs a poll two extra requests per issue on edges nobody is waiting on. The
            // closures that DO matter travel on the blocker edges, which carry their own.
            let issues: [GitHubIssue] = try await get(
                "/repos/\(scope)/issues?state=open&per_page=\(Self.pageSize)&page=\(page)",
                grant: grant,
            )
            for issue in issues where issue.pullRequest == nil {
                try await items.append(workItem(issue, in: scope, grant: grant))
            }
            if issues.count < Self.pageSize {
                break
            }
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
            ? try await get("\(path)/sub_issues?per_page=\(Self.pageSize)", grant: grant)
            : []
        let blockers: [GitHubIssue] = issue.hasBlockers
            ? try await get(
                "\(path)/dependencies/blocked_by?per_page=\(Self.pageSize)",
                grant: grant,
            )
            : []
        return issue.workItem(
            children: children.map(\.number),
            blockedBy: blockers.map { WorkItemBlocker(number: $0.number, closure: $0.closure) },
        )
    }
}
