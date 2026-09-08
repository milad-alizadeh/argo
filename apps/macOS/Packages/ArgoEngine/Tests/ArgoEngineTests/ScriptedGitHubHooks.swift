@testable import ArgoEngine
import Foundation

/// GitHub's hooks endpoint, scripted: the create is answered from a list in the order a dial meets
/// its entries, the last one repeating. One path answering two different ways is what
/// `RecordedGitHub` cannot do — it keys each reply by the path that asked for it, and the create,
/// the listing and the delete are all one path.
actor ScriptedGitHubHooks: HTTPTransport {
    private var creates: [String]
    private let holding: String
    private let refusing: Set<HTTPMethod>
    private var sent: [HTTPRequest] = []

    /// `refusing` is the verbs this host throws on rather than answers, which is how a suite says
    /// the token may create but may not delete.
    init(creates: [String], holding: String = "[]", refusing: Set<HTTPMethod> = []) {
        self.creates = creates
        self.holding = holding
        self.refusing = refusing
    }

    func send(_ request: HTTPRequest) throws -> Data {
        sent.append(request)
        if refusing.contains(request.method) {
            throw HTTPTransportError.unauthorized(code: 403, reason: nil)
        }
        switch request.method {
        case .post:
            return Data(nextCreate().utf8)
        case .get:
            return Data(holding.utf8)
        case .delete, .patch:
            return Data("{}".utf8)
        }
    }

    /// Every request this host was asked, in order — the GETs among them, since half of what a
    /// recovered dial claims is about requests it did NOT send.
    func requests() -> [HTTPRequest] {
        sent
    }

    private func nextCreate() -> String {
        creates.count > 1 ? creates.removeFirst() : creates.first ?? ""
    }
}
