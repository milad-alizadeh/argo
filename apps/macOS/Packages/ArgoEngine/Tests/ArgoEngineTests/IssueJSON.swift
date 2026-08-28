import Foundation

/// One issue as GitHub serves it, written the way GitHub writes it — so a listing test exercises
/// the decoder rather than a convenient subset of it.
struct IssueJSON {
    var number: Int
    /// GitHub's database id, which is deliberately NOT the number: a write that sent one where the
    /// other belongs would pass every assertion if the two were the same.
    var identifier: Int?
    var title = "A ticket"
    var state = "open"
    var reason: String?
    var labels: [String] = []
    /// The `color` GitHub serves beside a label name, per label. A name missing from here has its
    /// key DROPPED rather than nulled, which is how a label carrying no colour looks on the wire.
    var labelColours: [String: String] = [:]
    var assignees: [String] = []
    /// GitHub's own issue type, and `nil` for the repository that has not turned them on — where
    /// the key is ABSENT rather than null, which is what `dependencies` below is for too.
    var type: String?
    var body: String?
    /// The summary counts, which is all GitHub puts on the issue itself: they say an edge exists
    /// and never which issue is on the other end.
    var children = 0
    var blockers = 0
    /// Whether the host serves a dependency summary at all. `false` drops the key, which is how a
    /// provider with no dependency edges looks on the wire.
    var dependencies = true
    var pullRequest = false
    /// GitHub's `updated_at`, on the wire. `nil` drops the key, which is the only way a host that
    /// serves no timestamp can be told from one serving an unparseable string.
    var updated: String?

    var json: String {
        """
        { "id": \(identifier ?? Self.identifier(of: number)),
          "number": \(number), "title": "\(title)", "state": "\(state)",
          "state_reason": \(reason.map { "\"\($0)\"" } ?? "null"),
          "labels": [\(labelObjects)],
          "assignees": [\(Self.objects(assignees, named: "login"))],
          \(type.map { #""type": { "name": "\#($0)" },"# } ?? "")
          \(body.map { #""body": "\#($0)","# } ?? "")
          \(pullRequest ? #""pull_request": { "url": "u" },"# : "")
          \(updated.map { #""updated_at": "\#($0)","# } ?? "")
          \(Self.dependencySummary(blockers, served: dependencies))
          "sub_issues_summary": { "total": \(children), "completed": 0, "percent_completed": 0 } }
        """
    }

    /// The id GitHub would have given this number, derived so a suite never has to state one and a
    /// write test can still say which id it expected to travel.
    static func identifier(of number: Int) -> Int {
        1_000_000 + number
    }

    static func list(_ issues: [IssueJSON]) -> String {
        "[\(issues.map(\.json).joined(separator: ","))]"
    }

    private static func dependencySummary(_ blockers: Int, served: Bool) -> String {
        guard served else { return "" }
        return """
        "issue_dependencies_summary": { "blocked_by": \(blockers), "blocking": 0,
          "total_blocked_by": \(blockers), "total_blocking": 0 },
        """
    }

    /// A label object each, carrying `color` only where one was stated — the two shapes GitHub
    /// actually serves.
    private var labelObjects: String {
        labels.map { name in
            let colour = labelColours[name].map { #", "color": "\#($0)""# } ?? ""
            return #"{ "name": "\#(name)"\#(colour) }"#
        }
        .joined(separator: ",")
    }

    private static func objects(_ values: [String], named key: String) -> String {
        values.map { #"{ "\#(key)": "\#($0)" }"# }.joined(separator: ",")
    }
}
