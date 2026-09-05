import Foundation

/// Deleting a GitHub issue (#1247), which is the one write in this adapter that REST cannot make:
/// `/repos/{scope}/issues/{n}` has no `DELETE`, and `deleteIssue` lives on the GraphQL API alone.
/// Grounded on GitHub's own GraphQL mutation reference, read 2026-09-05.
///
/// The mutation names the issue by its GLOBAL node id and not by the number a human reads, so a
/// delete costs one read to address before it can be sent — the same trade every edge write in
/// `GitHubTickets+Intents` already makes.
extension GitHubTickets {
    /// GitHub's GraphQL endpoint hangs off the same API host every other call uses.
    private static let graphQL = "/graphql"

    private static let deleteIssue = """
    mutation DeleteIssue($id: ID!) {
      deleteIssue(input: { issueId: $id }) { clientMutationId }
    }
    """

    func deleteIssue(_ number: Int, through binding: ResolvedBinding) async throws {
        let issue: GitHubIssue = try await writes.read(
            path(of: number, through: binding), grant: binding.grant,
        )
        guard let node = issue.nodeId else {
            throw TicketWriteError.refused("GitHub did not say which record issue \(number) is.")
        }
        let reply = try await writes.send(
            .post(Self.graphQL, [
                "query": Self.deleteIssue, "variables": ["id": node],
            ]),
            grant: binding.grant,
        )
        try Self.refusal(in: reply)
    }

    /// GraphQL answers a refused mutation with `200` and an `errors` array, which the REST refusal
    /// read cannot see: it looks for a top-level `message`, and there is none. Unread, a delete
    /// the API declined would report as one that landed.
    private static func refusal(in reply: Data) throws {
        guard let failure = try? GitHubCall.decoder.decode(GraphQLReply.self, from: reply),
              let first = failure.errors?.first
        else { return }
        throw TicketWriteError.refused(first.message)
    }

    /// Only the half of a GraphQL reply that says the request was refused. What it succeeded with
    /// is not read: a delete has no record left to answer with.
    private struct GraphQLReply: Decodable {
        struct Failure: Decodable {
            let message: String
        }

        let errors: [Failure]?
    }
}
