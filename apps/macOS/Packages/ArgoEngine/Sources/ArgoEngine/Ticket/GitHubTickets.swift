import Foundation

/// The Ticket port filled by GitHub Issues, read through one Binding's grant.
///
/// Sibling to `GitHubTicketTitles`, which answers one number. This one enumerates, which is the
/// read a Tickets room and a poll are built on.
public struct GitHubTickets: TicketPort {
    let reads: GitHubReads
    let writes: GitHubWrites

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.reads = GitHubReads(transport: transport)
        self.writes = GitHubWrites(transport: transport)
    }

    /// `github.com/<owner>/<repo>/issues/<n>` — the browse URL, which is NOT the API path `path(of:
    /// through:)` builds. A blank scope addresses nothing rather than the host's own front page.
    public static func browseURL(of number: Int, in scope: String) -> URL? {
        guard !scope.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return URL(string: "https://github.com/\(scope)/issues/\(number)")
    }

    /// The host GitHub serves its web pages from, and the one alias it answers to.
    private static let browseHosts: Set<String> = ["github.com", "www.github.com"]

    /// Which issue of `scope` a URL addresses — `browseURL(of:in:)` read backwards (#1178).
    ///
    /// `/pull/<n>` is refused: a Delivery is not a Ticket. So is `/issues`, which is a listing.
    ///
    /// Owner and repository are matched case-insensitively, and the query and fragment ignored,
    /// because GitHub serves one page under all of those spellings.
    public static func ticketNumber(of url: URL, in scope: String) -> Int? {
        guard let host = url.host()?.lowercased(), browseHosts.contains(host) else { return nil }
        // Dropped so `…/issues/1175/` and `…/issues/1175` are one answer: a trailing slash leaves
        // an empty last component, and the path is otherwise read positionally.
        let path = url.pathComponents.filter { $0 != "/" && !$0.isEmpty }
        guard path.count == 4, path[2] == "issues" else { return nil }
        guard "\(path[0])/\(path[1])".lowercased() == scope.lowercased() else { return nil }
        // Providers number Tickets from one, so a `#0` is a misread of a link rather than a page.
        guard let number = Int(path[3]), number > 0 else { return nil }
        return number
    }

    /// How many tickets are read at once — and, because a ticket reads its two edges one after the
    /// other, how many requests are in flight. Bounded at all because a repository with hundreds of
    /// open issues is the fan-out GitHub's secondary limits refuse.
    static let concurrentTickets = 8

    public func list(in scope: String, grant: AccountGrant) async throws -> [Ticket] {
        // Open only. A closed ticket has left the room, and asking for every issue a repository
        // ever had costs a poll two extra requests per issue on edges nobody is waiting on. The
        // closures that DO matter travel on the blocker edges, which carry their own.
        let issues: [GitHubIssue] = try await reads.pages(
            [GitHubIssue].self, of: "/repos/\(scope)/issues?state=open", grant: grant,
        )
        return try await tickets(
            issues.filter { $0.pullRequest == nil }, in: scope, grant: grant,
        )
    }

    /// One page of the closed issues, last touched first (#1075).
    ///
    /// `sort=updated&direction=desc` is asked of the HOST rather than sorted here, which is what
    /// makes the paging honest: the page boundary and the row order are then the same order, so
    /// `Load more` cannot hand back an issue that belonged on the page before it.
    ///
    /// No `sub_issues` and no `blocked_by`, where `list` above spends a request on each summary
    /// that declares one — that fan-out is most of what the open listing costs, and a closed
    /// ticket's edges are nobody's question.
    public func closed(
        in scope: String, after cursor: String?, grant: AccountGrant,
    ) async throws
        -> ClosedTicketPage {
        let page = Self.page(after: cursor)
        let issues: [GitHubIssue] = try await reads.get(
            "/repos/\(scope)/issues?state=closed&sort=updated&direction=desc"
                + "&per_page=\(ClosedTicketPage.size)&page=\(page)",
            grant: grant,
        )
        return ClosedTicketPage(
            items: issues.filter { $0.pullRequest == nil }
                .map { $0.ticket(children: [], blockedBy: nil) },
            // Decided on the RAW count, never the filtered one: a page whose pull requests were
            // dropped is short without being last, and a cursor read off it would strand every
            // closed ticket behind the first repository that files PRs faster than issues.
            next: issues.count < ClosedTicketPage.size ? nil : String(page + 1),
        )
    }

    /// Which page a cursor names. GitHub pages by NUMBER, so its cursor is the next page's own —
    /// and no cursor, or one this adapter did not write, starts at the first.
    private static func page(after cursor: String?) -> Int {
        max(cursor.flatMap(Int.init) ?? 1, 1)
    }

    /// GitHub serves pull requests from `/issues/<N>` too, and a Delivery is not a Ticket
    /// (`CONTEXT.md` L4) — so one is `nil` here on the same terms a number behind which there is
    /// nothing is.
    public func ticket(
        number: Int, in scope: String, grant: AccountGrant,
    ) async throws
        -> Ticket? {
        let issue: GitHubIssue? = try await reads.found(
            "/repos/\(scope)/issues/\(number)", grant: grant,
        )
        guard let issue, issue.pullRequest == nil else { return nil }
        return try await ticket(issue, in: scope, grant: grant)
    }

    /// Every ticket with its edges, `concurrentTickets` at a time and back in the order served —
    /// the backlog draws in the provider's own order, and a fan-out lands in the host's.
    private func tickets(
        _ issues: [GitHubIssue], in scope: String, grant: AccountGrant,
    ) async throws
        -> [Ticket] {
        try await withThrowingTaskGroup(of: (Int, Ticket).self) { group in
            var read = [Ticket?](repeating: nil, count: issues.count)
            for (index, issue) in issues.enumerated() {
                // Harvested before the next is added, from the point the group is full. This IS
                // the throttle — without it the loop would add one task per ticket.
                if index >= Self.concurrentTickets, let (at, item) = try await group.next() {
                    read[at] = item
                }
                group.addTask {
                    try await (index, ticket(issue, in: scope, grant: grant))
                }
            }
            for try await (at, item) in group {
                read[at] = item
            }
            // Every slot was filled above, so this drops nothing.
            return read.compactMap(\.self)
        }
    }

    /// The edges, asked for only where the issue's own summary says there is one. The summaries
    /// carry counts and never numbers, so they answer "is there an edge" and never "which".
    func ticket(
        _ issue: GitHubIssue, in scope: String, grant: AccountGrant,
    ) async throws
        -> Ticket {
        let path = "/repos/\(scope)/issues/\(issue.number)"
        let children: [GitHubIssue] = issue.hasChildren
            ? try await reads.pages([GitHubIssue].self, of: "\(path)/sub_issues", grant: grant)
            : []
        let blockers: [GitHubIssue] = issue.hasBlockers
            ? try await reads.pages(
                [GitHubIssue].self, of: "\(path)/dependencies/blocked_by", grant: grant,
            )
            : []
        return issue.ticket(
            children: children.map(\.number),
            // A host that served no summary served no edges either, and that is `nil` rather than
            // the empty list a host with none of them answers with.
            blockedBy: issue.issueDependenciesSummary == nil
                ? nil
                : blockers.map { TicketBlocker(number: $0.number, closure: $0.closure) },
        )
    }
}
