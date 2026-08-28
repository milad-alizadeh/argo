@testable import ArgoEngine
import Foundation

/// GitHub's endpoints, recorded — issues for the Work Item port, pulls and checks for the code
/// host. Each reply is keyed by the part of the path that names it, so a test says which endpoint
/// answered what rather than which request number did: a read makes a different number of requests
/// depending on what it finds.
actor RecordedGitHub: HTTPTransport {
    private let replies: [String: String]
    private let failure: Error?
    private var sent: [HTTPRequest] = []

    init(replies: [String: String], failure: Error? = nil) {
        self.replies = replies
        self.failure = failure
    }

    func send(_ request: HTTPRequest) throws -> Data {
        sent.append(request)
        if let failure {
            throw failure
        }
        // The longest match wins, not the first: a paged edge URL carries both `blocked_by` and
        // `&page=1`, and picking between them by dictionary order made which reply a suite got
        // depend on the hash seed of the run.
        let reply = replies
            .filter { request.url.contains($0.key) }
            .max { $0.key.count < $1.key.count }?
            .value
        return Data((reply ?? "[]").utf8)
    }

    func urls() -> [String] {
        sent.map(\.url)
    }

    /// Every request that carried a verb other than GET — what a write test asserts on, since half
    /// of what the port claims is about requests NOT made.
    func writes() -> [RecordedWrite] {
        sent.filter { $0.method != .get }.map(RecordedWrite.init)
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
