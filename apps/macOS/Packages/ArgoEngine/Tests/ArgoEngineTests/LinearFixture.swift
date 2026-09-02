@testable import ArgoEngine

/// The team every Linear suite reads through: five columns, one label, one blocking edge.
///
/// A whole team rather than a reply per test, because a Linear write asks for two or three of
/// these on one intent — a `transitionTo` reads the columns, a `setParent` reads the far end.
enum LinearFixture {
    /// A team spelling the same five columns Linear's own default workflow does. `Backlog` and
    /// `Todo` are BOTH `todo` columns, which is what the by-position pick exists to choose
    /// between.
    static let states = """
    { "data": { "team": { "states": { "nodes": [
      { "id": "s-backlog", "name": "Backlog", "type": "backlog", "position": 0 },
      { "id": "s-todo", "name": "Todo", "type": "unstarted", "position": 1 },
      { "id": "s-doing", "name": "In Progress", "type": "started", "position": 2 },
      { "id": "s-done", "name": "Done", "type": "completed", "position": 3 },
      { "id": "s-cancelled", "name": "Canceled", "type": "canceled", "position": 4 }
    ] } } } }
    """

    static let label = #"{ "data": { "issueLabels": { "nodes": [{ "id": "label-engine" }] } } }"#

    /// Issue 9 blocks the subject, which is the edge `removeBlockedBy` has to find by its own id.
    static let blockers = """
    { "data": { "issue": { "inverseRelations": { "nodes": [
      { "id": "rel-9", "type": "blocks", "issue": { "number": 9 } }
    ] } } } }
    """

    static let filed = """
    { "data": { "result": { "success": true, "issue": { "number": 101 } } } }
    """

    /// The replies every write path needs beside the issues themselves.
    static let team: [String: String] = [
        "query TeamStates": states,
        "query Label": label,
        "query Blockers": blockers,
        "mutation IssueCreate": filed,
    ]

    /// A Linear transport holding these issues, with the team's own columns and labels behind it.
    static func holding(_ issues: [LinearIssueJSON]) -> RecordedLinear {
        RecordedLinear(holding: issues, replies: team)
    }
}

extension ResolvedBinding {
    /// A Ticket Binding resolved onto one Linear identity. The scope is a team id, which is what
    /// a Linear Binding holds where a GitHub one holds `owner/repo`.
    static func linear(scope: String = "team-eng") -> ResolvedBinding {
        let account = AccountRecord(
            provider: .linear, providerAccountID: "L1", displayName: "milad",
        )
        return ResolvedBinding(
            binding: ProjectBinding(port: .ticket, accountID: account.id, scope: scope),
            account: account,
            grant: AccountGrant(accessToken: "lin_api_key", scopes: ["read", "write"]),
        )
    }
}
