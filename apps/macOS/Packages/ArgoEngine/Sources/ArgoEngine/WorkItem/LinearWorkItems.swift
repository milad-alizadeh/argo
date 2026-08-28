import Foundation

/// The Work Item port filled by Linear, read through one Binding's grant.
///
/// The port's second implementation, and the thing that makes it a port: nothing here is a branch
/// in the poll (#371, `WorkItemPort`). The scope is a team id, which is what a Linear Binding
/// holds (`CONTEXT.md` L1 · Binding).
public struct LinearWorkItems: WorkItemPort {
    let call: LinearCall

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.call = LinearCall(transport: transport)
    }

    /// Linear's own ceiling for a connection page, and the same runaway backstop `GitHubReads`
    /// keeps: a read that walked forever would leave the health chip claiming a read in flight.
    private static let pageSize = 100
    private static let pageLimit = 20

    /// Nothing — and that is the honest answer, not a gap left for later. A Linear issue is
    /// addressed `linear.app/<workspace>/issue/<TEAM-KEY>-<n>`, and a Linear Binding holds a team
    /// ID: neither the workspace slug nor the team's key. A URL guessed from the id would 404, and
    /// the room disables the two link verbs on this `nil` rather than drawing them live and inert.
    public static func browseURL(of _: Int, in _: String) -> URL? {
        nil
    }

    public func list(in scope: String, grant: AccountGrant) async throws -> [WorkItem] {
        var items: [WorkItem] = []
        var after: LinearValue = .null
        for _ in 1 ... Self.pageLimit {
            let page = try await page(in: scope, after: after, grant: grant)
            items += page.nodes.map { $0.workItem() }
            guard page.pageInfo.hasNextPage, let cursor = page.pageInfo.endCursor else {
                return items
            }
            after = .string(cursor)
        }
        return items
    }

    private func page(
        in scope: String, after: LinearValue, grant: AccountGrant,
    ) async throws
        -> LinearPage<LinearIssue> {
        do {
            let payload: LinearTeamPayload<LinearIssuePage> = try await call.payload(
                LinearOperation(
                    LinearDocuments.teamIssues,
                    ["team": .string(scope), "first": .int(Self.pageSize), "after": after],
                ),
                grant: grant,
            )
            // A team this identity cannot see comes back as a null team rather than as an error,
            // and reading that as an empty backlog would draw a room with nothing in it.
            guard let team = payload.team else { throw LinearFailure.unreadable }
            return team.issues
        } catch let failure as LinearFailure {
            throw failure.fetchError
        }
    }

    /// One ticket by the number Argo holds, in whatever state it is now — the read a write adopts
    /// through, and `nil` where the team holds no such number.
    func issue(
        _ number: Int, in scope: String, grant: AccountGrant,
    ) async throws(LinearFailure)
        -> LinearIssue? {
        let payload: LinearTeamPayload<LinearIssueList> = try await call.payload(
            LinearOperation(LinearDocuments.teamIssue, Self.addressing(number, in: scope)),
            grant: grant,
        )
        guard let team = payload.team else { throw LinearFailure.unreadable }
        return team.issues.nodes.first
    }

    /// The two variables every by-number document takes.
    static func addressing(_ number: Int, in scope: String) -> [String: LinearValue] {
        ["team": .string(scope), "number": .int(number)]
    }
}
