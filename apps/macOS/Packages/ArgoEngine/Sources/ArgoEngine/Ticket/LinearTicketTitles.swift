import Foundation

/// What a Ticket number is CALLED, read through a Linear Binding (`CONTEXT.md` L1 · Ticket).
///
/// The sibling of `GitHubTicketTitles`, and what fills the arm `TicketTitleResolver` has been
/// carrying as `nil` since #745 (#371). Argo stores the link and the provider owns the words, so
/// this fetches the one thing: the title, for a number Argo already had.
public struct LinearTicketTitles: Sendable {
    private let call: LinearCall

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.call = LinearCall(transport: transport)
    }

    /// `scope` is the Binding's own team id, passed rather than looked up for the reason
    /// `ResolvedBinding` carries its grant: two Projects on two Accounts differ in nothing else.
    ///
    /// Three answers, on `GitHubTicketTitles`' terms. A ticket is `.named`; a team that answered
    /// and holds no such number is `.absent`; and `nil` is everything that established nothing —
    /// a refusal, a team this identity cannot see, a read that never landed. Only the last of
    /// those keeps a title, and none of them may retire one wrongly.
    public func read(
        titleOf number: Int, in scope: String, grant: AccountGrant,
    ) async
        -> TicketTitleReading? {
        let operation = LinearOperation(
            LinearDocuments.teamIssueTitle, LinearTickets.addressing(number, in: scope),
        )
        guard let payload: LinearTeamPayload<LinearTitleList> = try? await call.payload(
            operation, grant: grant,
        ) else { return nil }
        // A null team is Linear saying this identity cannot see it, which establishes nothing
        // about the ticket — unlike a team that answered with no matching number.
        guard let team = payload.team else { return nil }
        guard let title = LinearAPI.text(team.issues.nodes.first?.title) else { return .absent }
        return .named(title)
    }
}
