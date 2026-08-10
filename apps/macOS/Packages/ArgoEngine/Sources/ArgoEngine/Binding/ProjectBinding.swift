import Foundation

/// A Project's use of one Account through one port, plus the provider-side scope that Account
/// reads through (CONTEXT.md L1 · Binding).
///
/// Named `ProjectBinding` rather than `Binding` because `ArgoUI` imports both this module and
/// SwiftUI, where `Binding` is one of the most-used names in the language.
///
/// The scope is a provider-side address held as an opaque string — GitHub's `owner/repo`, Linear's
/// team id. Typing it per provider would put a GitHub-shaped and a Linear-shaped case in a value
/// whose whole job is to be the same shape for every port; what the string *means* is the
/// adapter's, and validating it is `BindingScopeCheck`'s.
///
/// The Account is named by id and not by record, so an Account that renames upstream, or is removed
/// and authorized again, needs nothing here rewritten. It is also why a Binding can outlive the
/// Account it names — see `BindingResolution` for what that reads as.
public struct ProjectBinding: Equatable, Sendable, Codable {
    public let port: AccountPort
    /// `AccountRecord.id` — the provider and its stable id for the identity, never the login.
    public let accountID: String
    public let scope: String

    public init(port: AccountPort, accountID: String, scope: String) {
        self.port = port
        self.accountID = accountID
        self.scope = scope
    }
}
