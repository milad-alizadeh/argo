import Foundation

/// One entry in the per-machine Account registry: one authenticated identity with one provider.
///
/// The key is the **provider's own stable id** for the identity, never the login — a GitHub user
/// renaming themselves is the same Account rendering a new name (CONTEXT.md L1), which is why
/// re-authorizing an identity already held updates the record instead of adding a second one.
///
/// The id is DERIVED rather than a fresh UUID, unlike `ProjectRecord`: the keychain entry and the
/// upsert both have to find an Account from the identity alone, with no lookup table.
public struct AccountRecord: Equatable, Sendable, Identifiable, Codable {
    public let provider: AccountProvider
    /// The provider's stable id for this identity — GitHub's numeric user id, Linear's user id.
    public let providerAccountID: String
    /// The login or workspace name. Mutable upstream, so it is display only and never a key.
    public let displayName: String

    public init(provider: AccountProvider, providerAccountID: String, displayName: String) {
        self.provider = provider
        self.providerAccountID = providerAccountID
        self.displayName = displayName
    }

    public var id: String {
        "\(provider.rawValue):\(providerAccountID)"
    }
}
