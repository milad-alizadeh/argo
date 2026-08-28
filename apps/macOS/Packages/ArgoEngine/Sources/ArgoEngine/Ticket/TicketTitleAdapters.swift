import Foundation

/// The title adapters a resolver picks between, as one value.
///
/// One value rather than two parameters, for the reason `BindingProviderSeams` gives: they are one
/// substitution, and a resolver holding a stubbed GitHub beside a live Linear would reach the
/// network from a test that thought it could not.
public struct TicketTitleAdapters: Sendable {
    public let gitHub: GitHubTicketTitles
    public let linear: LinearTicketTitles

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.gitHub = GitHubTicketTitles(transport: transport)
        self.linear = LinearTicketTitles(transport: transport)
    }
}
