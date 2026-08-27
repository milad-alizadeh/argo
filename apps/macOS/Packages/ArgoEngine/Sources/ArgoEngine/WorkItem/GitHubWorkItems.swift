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

    /// GitHub Issues has no priority field. Projects carries one, on a board rather than on the
    /// issue, and reading it is a different scope through a different API.
    public var carriesPriority: Bool {
        false
    }

    /// A hundred is GitHub's own ceiling for `per_page`; a short page is the last page.
    static let pageSize = 100
    /// Ten pages, so a repository with tens of thousands of issues cannot turn one poll into an
    /// unbounded walk. A truncated listing is the honest failure here — a poll that never returns
    /// leaves the health chip claiming a read is still in flight forever.
    static let pageLimit = 10

    public func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem] {
        var items: [WorkItem] = []
        for page in 1 ... Self.pageLimit {
            let issues: [GitHubIssue] = try await get(
                "/repos/\(scope)/issues?state=all&per_page=\(Self.pageSize)&page=\(page)",
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
