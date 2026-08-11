import Foundation

/// The secret half of an Account: what Argo presents when it reads as that identity.
///
/// It is a value, and the **only** place it is ever persisted is the keychain entry keyed by the
/// Account (ADR-0018). Nothing in `AccountRegistry` holds it, which is what makes the registry file
/// safe to sit unencrypted in application support.
///
/// GitHub's OAuth-App user token does not expire and so carries neither `expiresAt` nor
/// `refreshToken` (#367); Linear's does and carries both (#371). Both stay optional: reshaping
/// them later is a keychain migration, and a failed one costs the user the grant.
public struct AccountGrant: Equatable, Sendable, Codable {
    public let accessToken: String
    /// What the provider actually granted, which is not always what was asked for: an org that
    /// restricts an OAuth App can return a narrower set than the request. Held so a refusal reads
    /// as a missing scope rather than as a read that mysteriously 404s.
    public let scopes: [String]
    public let expiresAt: Date?
    public let refreshToken: String?

    public init(
        accessToken: String,
        scopes: [String],
        lifetime: AccountGrantLifetime = .nonExpiring,
    ) {
        self.accessToken = accessToken
        self.scopes = scopes
        self.expiresAt = lifetime.expiresAt
        self.refreshToken = lifetime.refreshToken
    }

    /// A grant with no expiry is not expired — a non-expiring token is the GitHub case, not an
    /// unknown one, so there is nothing to degrade here.
    public func isExpired(asOf now: Date) -> Bool {
        guard let expiresAt else { return false }
        return expiresAt <= now
    }
}

/// How long a grant lasts and what renews it — the two fields that differ per provider.
public enum AccountGrantLifetime: Equatable, Sendable {
    case nonExpiring
    case expiring(at: Date, refreshToken: String?)

    var expiresAt: Date? {
        switch self {
        case .nonExpiring: nil
        case let .expiring(at, _): at
        }
    }

    var refreshToken: String? {
        switch self {
        case .nonExpiring: nil
        case let .expiring(_, refreshToken): refreshToken
        }
    }
}
