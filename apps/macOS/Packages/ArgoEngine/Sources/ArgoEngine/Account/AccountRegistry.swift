import Foundation

/// The known set of Accounts on this machine.
///
/// Held as a value with every transition returning a new registry, the same shape as
/// `ProjectRegistry` and for the same reason: the rules below are testable with no filesystem and
/// no keychain in the way.
///
/// There is deliberately no *active* Account. A Project's use of one is a Binding (#B), so the
/// choice is per-Project and per-port — a single machine-wide current identity is the thing
/// ADR-0018's amendment exists to reject.
public struct AccountRegistry: Equatable, Sendable {
    public let accounts: [AccountRecord]

    public static let empty = AccountRegistry(accounts: [])

    /// One record per identity. A duplicate reaching the initialiser — a hand-edited file, two
    /// windows racing an older build — collapses to the first, so the invariant holds for readers
    /// that never went through `authorizing`.
    public init(accounts: [AccountRecord]) {
        var seen: Set<String> = []
        self.accounts = accounts.filter { seen.insert($0.id).inserted }
    }

    public func account(id: String?) -> AccountRecord? {
        accounts.first { $0.id == id }
    }

    public func accounts(for provider: AccountProvider) -> [AccountRecord] {
        accounts.filter { $0.provider == provider }
    }

    /// A completed grant, folded in. An identity already held is **updated in place** rather than
    /// appended: matching on the provider's id and not the login is what makes re-authorizing the
    /// same person one Account, and what lets an upstream rename land as a new `displayName` on the
    /// Account every Binding already names.
    func authorizing(_ account: AccountRecord) -> AccountRegistry {
        guard accounts.contains(where: { $0.id == account.id }) else {
            return AccountRegistry(accounts: accounts + [account])
        }
        return AccountRegistry(accounts: accounts.map { $0.id == account.id ? account : $0 })
    }

    /// Forget an Account. Only Argo's record goes — revoking the grant upstream is the provider's
    /// own screen, and claiming otherwise would be a fabricated DIRECT.
    func removing(id: String) -> AccountRegistry {
        AccountRegistry(accounts: accounts.filter { $0.id != id })
    }
}
