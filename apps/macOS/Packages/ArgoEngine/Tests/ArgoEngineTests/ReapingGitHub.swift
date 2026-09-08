@testable import ArgoEngine
import Foundation

/// GitHub with a reap window: the create is answered from a script, so one path answers two
/// different ways in the order a dial meets them. `RecordedGitHub` keys each reply by the path that
/// asked for it, which cannot tell a refused create from the one after it.
///
/// The last entry in the script repeats, so `[refusal]` is a repository that refuses every create.
actor ReapingGitHub: HTTPTransport {
    private var creates: [String]
    private let holding: String
    private var sent: [HTTPRequest] = []

    init(creates: [String], holding: String) {
        self.creates = creates
        self.holding = holding
    }

    func send(_ request: HTTPRequest) throws -> Data {
        sent.append(request)
        switch request.method {
        case .post:
            return Data(next().utf8)
        case .get:
            return Data(holding.utf8)
        case .delete, .patch:
            return Data("{}".utf8)
        }
    }

    /// Every request that carried a verb other than GET, in order — the deletes among them.
    func writes() -> [RecordedWrite] {
        sent.filter { $0.method != .get }.map(RecordedWrite.init)
    }

    /// Every request, GET included, which is what says a dial that landed read no listing.
    func methods() -> [HTTPMethod] {
        sent.map(\.method)
    }

    private func next() -> String {
        creates.count > 1 ? creates.removeFirst() : creates.first ?? "{}"
    }
}
