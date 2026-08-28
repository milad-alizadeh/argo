import Foundation

/// The title adapters a resolver picks between, as one value.
///
/// One value rather than two parameters, for the reason `BindingProviderSeams` gives: they are one
/// substitution, and a resolver holding a stubbed GitHub beside a live Linear would reach the
/// network from a test that thought it could not.
public struct WorkItemTitleAdapters: Sendable {
    public let gitHub: GitHubWorkItemTitles
    public let linear: LinearWorkItemTitles

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.gitHub = GitHubWorkItemTitles(transport: transport)
        self.linear = LinearWorkItemTitles(transport: transport)
    }
}
