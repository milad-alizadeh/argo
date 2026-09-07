import Foundation

/// Reading one path from GitHub, and walking a listing to its end.
struct GitHubReads: Sendable {
    let call: GitHubCall
    /// How long each listing's last walk ran. Held here rather than in the ETag ledger because it
    /// is a fact about PAGING and not about HTTP — the transport is asked one URL at a time and has
    /// no idea two of them are the same listing.
    private let spans = ListingSpans()

    init(transport: HTTPTransport) {
        self.call = GitHubCall(transport: transport)
    }

    /// A hundred is GitHub's own ceiling for `per_page`; a short page is the last page.
    private static let pageSize = 100
    /// A runaway backstop and not a working limit: a read that walked forever would leave the
    /// health chip claiming a read still in flight.
    private static let pageLimit = 20

    func get<Reply: Decodable>(_ path: String, grant: AccountGrant) async throws -> Reply {
        guard let reply: Reply = try await found(path, grant: grant) else {
            throw ProviderFetchError.unreachable
        }
        return reply
    }

    /// The same read, with GitHub's own `Not Found` told apart from an answer that established
    /// nothing: `nil` is the host saying there is nothing behind this path, and everything else it
    /// could not be read as throws. `GitHubTicketTitles` draws the same line for the same reason.
    func found<Reply: Decodable>(_ path: String, grant: AccountGrant) async throws -> Reply? {
        try await decoded(call.send(path, grant: grant))
    }

    /// Every item of one listing, walked until a short page ends it or the backstop does. The
    /// paging parameters are appended here, so nothing else in the module spells `per_page`.
    func pages<Page: GitHubPage>(
        _ page: Page.Type, of path: String, grant: AccountGrant,
    ) async throws
        -> [Page.Item] {
        switch try await walk(page, of: path, grant: grant, revalidating: false) {
        case let .answered(items): items
        // A walk that sent no validator gave the host nothing to answer `304` against, so this is
        // the host breaking its own contract rather than a listing that has not moved.
        case .unchanged: throw ProviderFetchError.unreachable
        }
    }

    /// The same walk, told it may come back as the host's word that the listing has not moved.
    ///
    /// Only for a caller that can still produce a listing from what it holds: `unchanged` here
    /// means the ledger's last answer for this path stands, and read as an empty listing it would
    /// clear whatever that answer marked (#1620).
    func pages<Page: GitHubPage>(
        _ page: Page.Type, of path: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<[Page.Item]> {
        try await walk(page, of: path, grant: grant, revalidating: revalidating)
    }

    /// One listing, page by page, each page its own request and so its own validator.
    ///
    /// A `304` is per page because the ETag is: `?page=2` is a different URL from `?page=1` and the
    /// host validates them separately. The walk ends where the previous one did, which is what
    /// makes a one-page listing cost ONE conditional request rather than one plus an empty probe
    /// for the page after it. That span is only ever a page the host answered SHORT — the walk
    /// breaks on `items.count < pageSize` and nowhere else — so a page-sized listing that has since
    /// grown cannot hide behind it: the short page would have had to fill up first, and a page that
    /// gained an item is a page whose ETag moved.
    private func walk<Page: GitHubPage>(
        _: Page.Type, of path: String, grant: AccountGrant, revalidating: Bool,
    ) async throws
        -> PortReading<[Page.Item]> {
        let separator = path.contains("?") ? "&" : "?"
        let span = revalidating ? await spans.span(of: path) : nil
        var items: [Page.Item] = []
        var unchanged = 0
        var asked = 0
        var completed = false
        for page in 1 ... Self.pageLimit {
            asked = page
            let url = "\(path)\(separator)per_page=\(Self.pageSize)&page=\(page)"
            let reply = try await call.fetch(url, grant: grant, revalidating: revalidating)
            guard case let .answered(data) = reply else {
                unchanged += 1
                if let span, page >= span {
                    completed = true
                    break
                }
                continue
            }
            guard let read: Page = try decoded(data) else { throw ProviderFetchError.unreachable }
            items.append(contentsOf: read.items)
            if read.items.count < Self.pageSize {
                completed = true
                break
            }
        }
        if unchanged == asked {
            return .unchanged
        }
        // Some pages moved and some did not, and a `304` leaves no items to splice into the gap.
        // Nothing here can assemble the whole listing, so it is walked again for its bodies — which
        // costs exactly what this listing cost before conditional requests, and no more.
        if unchanged > 0 {
            return try await walk(Page.self, of: path, grant: grant, revalidating: false)
        }
        // Not recorded for a walk the backstop cut short: that page count is the backstop's, not
        // the listing's, and holding it would end the next walk in the same wrong place.
        if completed {
            await spans.record(asked, of: path)
        }
        return .answered(items)
    }

    /// One GitHub body as the reply it carries, or `nil` where the host says there is nothing
    /// behind the path.
    ///
    /// Checked before the reply, not after it fails to parse: a 4xx GitHub hands back as a BODY
    /// passes through the transport like any other answer.
    private func decoded<Reply: Decodable>(_ data: Data) throws -> Reply? {
        let decoder = GitHubCall.decoder
        if let failure = try? decoder.decode(GitHubFailure.self, from: data) {
            guard failure.isNotFound else { throw ProviderFetchError.unreachable }
            return nil
        }
        guard let reply = try? decoder.decode(Reply.self, from: data) else {
            throw ProviderFetchError.unreachable
        }
        return reply
    }
}

/// How many pages each listing's last complete walk took, keyed by the path before the paging
/// parameters are appended.
private actor ListingSpans {
    private var spans: [String: Int] = [:]

    func span(of path: String) -> Int? {
        spans[path]
    }

    func record(_ pages: Int, of path: String) {
        spans[path] = pages
    }
}
