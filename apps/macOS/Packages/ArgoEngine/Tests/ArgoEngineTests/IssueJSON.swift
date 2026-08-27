@testable import ArgoEngine
import Foundation

/// One issue in the shape GitHub's REST API actually serves — the field names and the two summary
/// objects are copied from a live `gh api repos/…/issues/…`, not from a convenient subset.
struct IssueJSON {
    var number: Int
    var title = "A ticket"
    var state = "open"
    var reason: String?
    var labels: [String] = []
    var assignees: [String] = []
    /// The summary counts, which is all GitHub puts on the issue itself: they say an edge exists
    /// and never which issue is on the other end.
    var children = 0
    var blockers = 0
    var pullRequest = false

    var body: String {
        """
        { "number": \(number), "title": "\(title)", "state": "\(state)",
          "state_reason": \(reason.map { "\"\($0)\"" } ?? "null"),
          "labels": [\(Self.objects(labels, named: "name"))],
          "assignees": [\(Self.objects(assignees, named: "login"))],
          \(pullRequest ? #""pull_request": { "url": "u" },"# : "")
          "sub_issues_summary": { "total": \(children), "completed": 0, "percent_completed": 0 },
          "issue_dependencies_summary": { "blocked_by": \(blockers), "blocking": 0,
            "total_blocked_by": \(blockers), "total_blocking": 0 } }
        """
    }

    static func list(_ issues: [IssueJSON]) -> String {
        "[\(issues.map(\.body).joined(separator: ","))]"
    }

    private static func objects(_ values: [String], named key: String) -> String {
        values.map { #"{ "\#(key)": "\#($0)" }"# }.joined(separator: ",")
    }
}
