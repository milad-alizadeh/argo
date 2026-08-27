@testable import ArgoEngine
import Foundation

/// GitHub's endpoints, recorded — issues for the Work Item port, pulls and checks for the code
/// host. Each reply is keyed by the part of the path that names it, so a test says which endpoint
/// answered what rather than which request number did: a read makes a different number of requests
/// depending on what it finds.
actor RecordedGitHub: HTTPTransport {
    private let replies: [String: String]
    private let failure: Error?
    private var asked: [String] = []

    init(replies: [String: String], failure: Error? = nil) {
        self.replies = replies
        self.failure = failure
    }

    func send(_ request: HTTPRequest) throws -> Data {
        asked.append(request.url)
        if let failure {
            throw failure
        }
        let reply = replies.first { request.url.contains($0.key) }?.value
        return Data((reply ?? "[]").utf8)
    }

    func urls() -> [String] {
        asked
    }
}
