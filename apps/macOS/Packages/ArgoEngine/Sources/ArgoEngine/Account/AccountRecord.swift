import Foundation

/// One entry in the per-machine Account registry: one authenticated identity with one provider.
///
/// The key is the **provider's own stable id** for the identity, never the login — a GitHub user
/// renaming themselves is the same Account rendering a new name, exactly as a Project that moves
/// is the same Project at a new path (CONTEXT.md L1). Which is also why re-authorizing an identity
/// already held updates the record instead of adding a second one.
///
/// The id is derived rather than a fresh UUID, and that is the one place this differs from
/// `ProjectRecord`. Two things need to find an Account from the identity alone and nothing else:
/// the keychain entry the grant lives under, and the upsert that decides whether a completed grant
/// is a new Account. A random id would need a lookup table to answer either.
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
