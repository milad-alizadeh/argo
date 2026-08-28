@testable import ArgoEngine
import Foundation

/// One Linear issue as its GraphQL API serves it, spelled once so a suite states the ONE field it
/// is about. The sibling of `IssueJSON`, and shaped by the same rule: every default is the quiet
/// case, so a test that says nothing is testing nothing by accident.
struct LinearIssueJSON {
    var number: Int
    /// Linear's UUID, which is deliberately NOT the number: a write that sent one where the other
    /// belongs would pass every assertion if the two were the same.
    var identifier: String?
    var title = "A ticket"
    /// The team's own word for the column, which is what renders (#272).
    var state = "Todo"
    /// Linear's workflow-state CATEGORY, which is what the canonical bucket is read from.
    var category = "unstarted"
    var priority: String?
    var labels: [String] = []
    var assignee: String?
    var body: String?
    var children: [Int] = []
    /// The issues blocking this one, each with the category its own state is in — Linear serves
    /// the far end's state with the relation, so a blocker's closure costs no second request.
    var blockers: [(number: Int, category: String)] = []
    /// Issues Linear serves on the SAME connection under a type that is not a dependency edge —
    /// what a test asserting those are not read as blockers needs.
    var related: [Int] = []
    var updated: String?

    var json: String {
        """
        { "id": "\(identifier ?? Self.identifier(of: number))",
          "number": \(number), "title": "\(title)",
          "description": \(Self.quoted(body)),
          "priorityLabel": \(Self.quoted(priority ?? "No priority")),
          "updatedAt": \(Self.quoted(updated)),
          "state": { "name": "\(state)", "type": "\(category)" },
          "assignee": \(assignee.map { #"{ "displayName": "\#($0)" }"# } ?? "null"),
          "labels": { "nodes": [\(Self.objects(labels, named: "name"))] },
          "children": { "nodes": [\(Self.numbers(children))] },
          "inverseRelations": { "nodes": [\(relations)] } }
        """
    }

    /// The UUID Linear would have given this number, derived so a suite never has to state one and
    /// a write test can still say which id it expected to travel.
    static func identifier(of number: Int) -> String {
        "issue-\(number)"
    }

    /// A team holding these issues, as the listing query's answer.
    static func page(_ issues: [LinearIssueJSON], hasNext: Bool = false) -> String {
        let cursor = hasNext ? "\"next\"" : "null"
        return """
        { "data": { "team": { "issues": {
            "pageInfo": { "hasNextPage": \(hasNext), "endCursor": \(cursor) },
            "nodes": [\(issues.map(\.json).joined(separator: ","))] } } } }
        """
    }

    /// A team answering the by-number read, which takes no page info.
    static func one(_ issues: [LinearIssueJSON]) -> String {
        """
        { "data": { "team": { "issues": {
            "nodes": [\(issues.map(\.json).joined(separator: ","))] } } } }
        """
    }

    private var relations: String {
        let blocking = blockers.map { Self.edge("blocks", $0.number, $0.category) }
        return (blocking + related.map { Self.edge("related", $0, "unstarted") })
            .joined(separator: ",")
    }

    private static func edge(_ type: String, _ number: Int, _ category: String) -> String {
        """
        { "type": "\(type)", "issue": { "number": \(number),
          "state": { "name": "Open", "type": "\(category)" } } }
        """
    }

    private static func quoted(_ text: String?) -> String {
        text.map { "\"\($0)\"" } ?? "null"
    }

    private static func numbers(_ numbers: [Int]) -> String {
        numbers.map { #"{ "number": \#($0) }"# }.joined(separator: ",")
    }

    private static func objects(_ names: [String], named key: String) -> String {
        names.map { #"{ "\#(key)": "\#($0)" }"# }.joined(separator: ",")
    }
}
