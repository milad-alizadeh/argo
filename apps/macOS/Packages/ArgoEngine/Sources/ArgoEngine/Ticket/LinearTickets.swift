import Foundation

/// The Ticket port filled by Linear, read through one Binding's grant.
///
/// The port's second implementation, and the thing that makes it a port: nothing here is a branch
/// in the poll (#371, `TicketPort`). The scope is a team id, which is what a Linear Binding
/// holds (`CONTEXT.md` L1 · Binding).
public struct LinearTickets: TicketPort {
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

    /// Nothing, and for the reason above read backwards (#1178). A `linear.app` link names a
    /// workspace slug and a team KEY; a Linear Binding holds neither, so nothing here can tell one
    /// bound team's issue from another workspace's. Recognising it on the host alone would route a
    /// stranger's ticket into this Project's Tickets surface, which is worse than a web link.
    public static func ticketNumber(of _: URL, in _: String) -> Int? {
        nil
    }

    public func list(in scope: String, grant: AccountGrant) async throws -> [Ticket] {
        var items: [Ticket] = []
        var after: LinearValue = .null
        for _ in 1 ... Self.pageLimit {
            let request = PageRequest(document: LinearDocuments.teamIssues, scope: scope)
            let page = try await page(request.resuming(at: after), grant: grant)
            items += page.nodes.map { $0.ticket() }
            guard page.pageInfo.hasNextPage, let cursor = page.pageInfo.endCursor else {
                return items
            }
            after = .string(cursor)
        }
        return items
    }

    /// ONE page of the closed issues, last touched first, and the cursor behind it (#1075).
    ///
    /// One request and no walk, where `list` above pages to the end: the whole point of the bound
    /// is that the reader asks for the next page rather than the adapter taking them all.
    ///
    /// Nothing is stripped from what Linear served. Its `...Ticket` fragment carries children and
    /// the dependency edges in the SAME request, so a closed ticket's edges cost this adapter
    /// nothing — where GitHub spends a request per edge and therefore reads none.
    public func closed(
        in scope: String, after cursor: String?, grant: AccountGrant,
    ) async throws
        -> ClosedTicketPage {
        let request = PageRequest(
            document: LinearDocuments.teamClosedIssues,
            scope: scope,
            size: ClosedTicketPage.size,
        )
        let page = try await page(
            request.resuming(at: cursor.map(LinearValue.string) ?? .null), grant: grant,
        )
        return ClosedTicketPage(
            items: page.nodes.map { $0.ticket() },
            next: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : nil,
        )
    }

    /// What one listing page asks for: which document, whose team, how many, and where to resume.
    /// A value rather than four parameters, which is the cap and also the clearer read — three of
    /// the four are the same on every page of one walk.
    private struct PageRequest {
        let document: String
        let scope: String
        var size = LinearTickets.pageSize
        var after: LinearValue = .null

        func resuming(at cursor: LinearValue) -> PageRequest {
            var next = self
            next.after = cursor
            return next
        }

        var variables: [String: LinearValue] {
            ["team": .string(scope), "first": .int(size), "after": after]
        }
    }

    private func page(
        _ request: PageRequest, grant: AccountGrant,
    ) async throws
        -> LinearPage<LinearIssue> {
        do {
            let payload: LinearTeamPayload<LinearIssuePage> = try await call.payload(
                LinearOperation(request.document, request.variables),
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

    /// Linear can answer this one: `LinearDocuments.teamIssue` is deliberately unfiltered by
    /// state, where the listing above drops everything completed or cancelled.
    public func ticket(
        number: Int, in scope: String, grant: AccountGrant,
    ) async throws
        -> Ticket? {
        do {
            return try await issue(number, in: scope, grant: grant)?.ticket()
        } catch {
            throw error.fetchError
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
