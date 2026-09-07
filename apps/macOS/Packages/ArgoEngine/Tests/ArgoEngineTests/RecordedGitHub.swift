@testable import ArgoEngine
import Foundation
import Testing

/// GitHub's endpoints, recorded — issues for the Ticket port, pulls and checks for the code
/// host. Each reply is keyed by the part of the path that names it, so a test says which endpoint
/// answered what rather than which request number did: a read makes a different number of requests
/// depending on what it finds.
actor RecordedGitHub: HTTPTransport {
    /// The open-issue listing's key, spelled once against `GitHubTickets`' own path — every Work
    /// Item suite keys its listing by this, and a query string that moves lands here.
    static let openIssues = "issues?state=open"

    /// One page of the CLOSED listing, keyed by the whole query `GitHubTickets.closed` builds —
    /// spelled here rather than by fragment, so a suite keying a page is also asserting the order
    /// and the bound that page was asked for under (#1075).
    static func closedIssues(page: Int) -> String {
        "issues?state=closed&sort=updated&direction=desc"
            + "&per_page=\(ClosedTicketPage.size)&page=\(page)"
    }

    /// What GitHub answers a landed `deleteIssue` with — a GraphQL reply carrying no `errors`,
    /// which is the only half of it the adapter reads (#1247).
    static let deleted = #"{ "data": { "deleteIssue": { "clientMutationId": null } } }"#

    private let replies: [String: String]
    private let failure: Error?
    /// The keys whose URLs this host will validate rather than answer twice — it answers the first
    /// ask with a body and every conditional ask after it with `304`, which is what a host does for
    /// a page nobody has touched (#1620).
    private let validating: Set<String>
    private var answered: Set<String> = []
    private var sent: [HTTPRequest] = []

    init(replies: [String: String], failure: Error? = nil, validating: Set<String> = []) {
        self.replies = replies
        self.failure = failure
        self.validating = validating
    }

    func send(_ request: HTTPRequest) throws -> Data {
        sent.append(request)
        if let failure {
            throw failure
        }
        return Data(reply(to: request.url).utf8)
    }

    func fetch(_ request: HTTPRequest) throws -> HTTPReply {
        // A host answers `304` only to a request that carried a validator, and only for a URL it
        // has already handed a body — and an ETag with it — for.
        if request.revalidating, answered.contains(request.url), isValidated(request.url) {
            sent.append(request)
            return .unchanged
        }
        let data = try send(request)
        answered.insert(request.url)
        return .answered(data)
    }

    /// Which requests went out carrying `If-None-Match`, in order — what a suite asserts on when
    /// the claim is about WHICH reads a tick was willing to have validated.
    func conditional() -> [String] {
        sent.filter(\.revalidating).map(\.url)
    }

    private func isValidated(_ url: String) -> Bool {
        validating.contains { url.contains($0) }
    }

    func urls() -> [String] {
        sent.map(\.url)
    }

    /// Every request that carried a verb other than GET — what a write test asserts on, since half
    /// of what the port claims is about requests NOT made.
    func writes() -> [RecordedWrite] {
        sent.filter { $0.method != .get }.map(RecordedWrite.init)
    }

    /// The most specific key that names this URL. The longest match wins, not the first: a paged
    /// edge URL carries both `blocked_by` and `&page=1`, and picking between them by dictionary
    /// order made which reply a suite got depend on the hash seed of the run.
    private func reply(to url: String) -> String {
        let matched = replies.keys.filter { url.contains($0) }.sorted()
        guard let longest = matched.max(by: { $0.count < $1.count }) else { return "[]" }
        // Two matches of the SAME length leave specificity nothing to choose between, so the seed
        // would decide again. Sorted above, so the suite that gets told is told the same thing.
        if matched.contains(where: { $0 != longest && $0.count == longest.count }) {
            Issue.record("\(url) matches \(matched) — the keys must tell this read's paths apart")
        }
        return replies[longest] ?? "[]"
    }
}

/// One write as it went out: the verb, the path, and the fields it carried.
struct RecordedWrite: Sendable {
    let method: HTTPMethod
    let path: String
    /// Stringified at the boundary rather than held as `Any`, which would not be `Sendable`.
    private let fields: [String: String]

    init(_ request: HTTPRequest) {
        self.method = request.method
        self.path = request.url.replacingOccurrences(of: GitHubOAuthApp.apiHost, with: "")
        guard case let .json(data) = request.body,
              let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            self.fields = [:]
            return
        }
        self.fields = decoded.mapValues(Self.text)
    }

    func field(_ key: String) -> String? {
        fields[key]
    }

    /// A string bare, and everything else in the spelling it went over the wire with — so a suite
    /// asserting on a list or a flag sees `["engine"]` and `true` rather than a description.
    private static func text(_ value: Any) -> String {
        if let string = value as? String {
            return string
        }
        let json = try? JSONSerialization.data(
            withJSONObject: value, options: [.fragmentsAllowed],
        )
        return json.flatMap { String(data: $0, encoding: .utf8) } ?? "\(value)"
    }
}
