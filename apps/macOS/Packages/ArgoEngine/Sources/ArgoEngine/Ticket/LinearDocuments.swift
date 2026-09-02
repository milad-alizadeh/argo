import Foundation

/// Every GraphQL document this adapter sends, spelled once.
///
/// Constants with no interpolation in them: a scope, a title and a label all travel as variables,
/// so nothing a user or a provider typed can change what an operation MEANS.
///
/// Each mutation aliases its field to `result`, so one payload shape reads every one of them —
/// without the alias each mutation would need a `Decodable` model differing only in a key.
enum LinearDocuments {
    /// The fields one ticket is read from, everywhere it is read. A listing and a write's read-back
    /// share it, so an adopted ticket and a listed one can never be told apart by what they carry.
    private static let ticket = """
    fragment Ticket on Issue {
      id number title description priorityLabel updatedAt
      state { name type }
      assignee { displayName }
      labels(first: 50) { nodes { name color } }
      children(first: 100) { nodes { number } }
      inverseRelations(first: 50) { nodes { type issue { number state { name type } } } }
    }
    """

    /// Open only, on the same reasoning `GitHubTickets.list` gives: a closed ticket has left the
    /// room. Linear says "not closed" as two null timestamps rather than as a state word.
    static let teamIssues = """
    query TeamIssues($team: String!, $first: Int!, $after: String) {
      team(id: $team) {
        issues(
          first: $first
          after: $after
          filter: { completedAt: { null: true }, canceledAt: { null: true } }
        ) {
          pageInfo { hasNextPage endCursor }
          nodes { ...Ticket }
        }
      }
    }
    \(ticket)
    """

    /// Closed only, and the exact complement of `teamIssues` above: an issue is closed here when
    /// EITHER timestamp is set, where the listing wants both null (#1075).
    ///
    /// `orderBy: updatedAt` is asked of Linear rather than sorted after the fact, so the page
    /// boundary and the row order are the same order — the cursor is only honest under the order
    /// the pages were cut in.
    static let teamClosedIssues = """
    query TeamClosedIssues($team: String!, $first: Int!, $after: String) {
      team(id: $team) {
        issues(
          first: $first
          after: $after
          orderBy: updatedAt
          filter: { or: [
            { completedAt: { null: false } }, { canceledAt: { null: false } }
          ] }
        ) {
          pageInfo { hasNextPage endCursor }
          nodes { ...Ticket }
        }
      }
    }
    \(ticket)
    """

    /// One ticket by the number Argo holds. Every state, unlike the listing: a write's subject may
    /// have just been closed, and reading it back as absent would strand the adopt.
    static let teamIssue = """
    query TeamIssue($team: String!, $number: Float!) {
      team(id: $team) {
        issues(first: 1, filter: { number: { eq: $number } }) { nodes { ...Ticket } }
      }
    }
    \(ticket)
    """

    static let teamIssueTitle = """
    query TeamIssueTitle($team: String!, $number: Float!) {
      team(id: $team) {
        issues(first: 1, filter: { number: { eq: $number } }) { nodes { title } }
      }
    }
    """

    static let teamStates = """
    query TeamStates($team: String!) {
      team(id: $team) { states(first: 100) { nodes { id name type position } } }
    }
    """

    static let label = """
    query Label($name: String!) {
      issueLabels(first: 1, filter: { name: { eq: $name } }) { nodes { id name } }
    }
    """

    static let blockers = """
    query Blockers($id: String!) {
      issue(id: $id) { inverseRelations(first: 50) { nodes { id type issue { number } } } }
    }
    """

    static let issueCreate = """
    mutation IssueCreate($input: IssueCreateInput!) {
      result: issueCreate(input: $input) { success issue { number } }
    }
    """

    static let issueUpdate = """
    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      result: issueUpdate(id: $id, input: $input) { success }
    }
    """

    static let addLabel = """
    mutation AddLabel($id: String!, $label: String!) {
      result: issueAddLabel(id: $id, labelId: $label) { success }
    }
    """

    static let removeLabel = """
    mutation RemoveLabel($id: String!, $label: String!) {
      result: issueRemoveLabel(id: $id, labelId: $label) { success }
    }
    """

    static let relationCreate = """
    mutation RelationCreate($input: IssueRelationCreateInput!) {
      result: issueRelationCreate(input: $input) { success }
    }
    """

    static let relationDelete = """
    mutation RelationDelete($id: String!) {
      result: issueRelationDelete(id: $id) { success }
    }
    """
}
