import Foundation

/// A Project's use of one Account through one port, plus the provider-side scope that Account
/// reads through (CONTEXT.md L1 · Binding).
///
/// Named `ProjectBinding` rather than `Binding` because `ArgoUI` imports both this module and
/// SwiftUI, where `Binding` is taken.
///
/// The scope is a provider-side address held as an opaque string — GitHub's `owner/repo`, Linear's
/// team id. What it *means* is the adapter's, and validating it is `BindingScopeCheck`'s.
///
/// The Account is named by id and not by record, so a Binding can outlive the Account it names —
/// see `BindingResolution` for what that reads as.
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
