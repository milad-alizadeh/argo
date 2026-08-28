@testable import ArgoEngine
import Foundation
import Testing

/// Linear's one endpoint, recorded. Every operation is a POST to the same URL, so a reply is keyed
/// by what the DOCUMENT names rather than by a path the way `RecordedGitHub` keys its own — which
/// is the whole shape of the difference between the two providers' plumbing.
///
/// The by-number reads answer from `issues` rather than from a keyed reply, because a write asks
/// for three different numbers on one operation and a keyed reply cannot tell them apart.
actor RecordedLinear: HTTPTransport {
    private let issues: [LinearIssueJSON]
    private let replies: [String: String]
    private let failure: Error?
    private var sent: [LinearOperation] = []

    init(
        holding issues: [LinearIssueJSON] = [],
        replies: [String: String] = [:],
        failure: Error? = nil,
    ) {
        self.issues = issues
        self.replies = replies
        self.failure = failure
    }

    func send(_ request: HTTPRequest) throws -> Data {
        guard case let .json(body) = request.body,
              let operation = try? JSONDecoder().decode(LinearOperation.self, from: body)
        else {
            Issue.record("a Linear request must carry a GraphQL operation")
            return Data("{}".utf8)
        }
        sent.append(operation)
        if let failure {
            throw failure
        }
        return Data(reply(to: operation).utf8)
    }

    /// Every document that went out, in order — what a test asserting on requests NOT made reads.
    func documents() -> [String] {
        sent.map(\.query)
    }

    /// The variables the first operation naming this key carried, and `nil` where none did.
    func variables(of key: String) -> [String: LinearValue]? {
        sent.first { $0.query.contains(key) }?.variables
    }

    private func reply(to operation: LinearOperation) -> String {
        if let keyed = keyed(operation.query) {
            return keyed
        }
        let query = operation.query
        if query.contains("query TeamIssues(") {
            return LinearIssueJSON.page(issues)
        }
        if query.contains("query TeamIssue(") {
            return LinearIssueJSON.one(named(in: operation))
        }
        if query.contains("query TeamIssueTitle(") {
            return Self.titles(named(in: operation))
        }
        return Self.mutation
    }

    /// The issue the operation's `number` variable names, as a list of nought or one — which is
    /// exactly what Linear's own filtered connection answers with.
    private func named(in operation: LinearOperation) -> [LinearIssueJSON] {
        guard case let .int(number)? = operation.variables["number"] else { return [] }
        return issues.filter { $0.number == number }
    }

    /// The most specific key naming this document, on `RecordedGitHub`'s rule: longest match wins,
    /// and two of the same length are reported rather than decided by the run's hash seed.
    private func keyed(_ document: String) -> String? {
        let matched = replies.keys.filter { document.contains($0) }.sorted()
        guard let longest = matched.max(by: { $0.count < $1.count }) else { return nil }
        if matched.contains(where: { $0 != longest && $0.count == longest.count }) {
            Issue.record("\(matched) all name one document — the keys must tell them apart")
        }
        return replies[longest]
    }

    /// A mutation that landed. Every mutation this adapter sends aliases its field to `result`,
    /// which is what lets one reply stand for all of them.
    static let mutation = #"{ "data": { "result": { "success": true } } }"#

    private static func titles(_ issues: [LinearIssueJSON]) -> String {
        let nodes = issues.map { #"{ "title": "\#($0.title)" }"# }.joined(separator: ",")
        return #"{ "data": { "team": { "issues": { "nodes": [\#(nodes)] } } } }"#
    }
}

/// `LinearOperation` is `Encodable` in the module, and the recorder has to read one back off the
/// wire to know what was asked for.
extension LinearOperation: Decodable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Key.self)
        try self.init(
            container.decode(String.self, forKey: .query),
            container.decodeIfPresent([String: LinearValue].self, forKey: .variables) ?? [:],
        )
    }

    private enum Key: String, CodingKey {
        case query
        case variables
    }
}

extension LinearValue: Decodable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let text = try? container.decode(String.self) {
            self = .string(text)
        } else if let number = try? container.decode(Int.self) {
            self = .int(number)
        } else if let flag = try? container.decode(Bool.self) {
            self = .bool(flag)
        } else if let values = try? container.decode([LinearValue].self) {
            self = .list(values)
        } else {
            self = try .object(container.decode([String: LinearValue].self))
        }
    }
}
