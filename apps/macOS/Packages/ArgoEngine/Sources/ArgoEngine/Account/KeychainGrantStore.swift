import Foundation
import Security

/// The real grant store: one generic-password item per Account in the login keychain.
///
/// The item's account attribute is `AccountRecord.id` — provider plus the provider's stable id —
/// so a personal and a work GitHub occupy two entries that cannot overwrite one another, and a
/// login rename moves nothing.
public struct KeychainGrantStore: AccountGrantStore {
    public static let defaultService = "com.argo.cockpit.accounts"

    private let service: String

    public init(service: String = KeychainGrantStore.defaultService) {
        self.service = service
    }

    public func store(_ grant: AccountGrant, for accountID: String) async throws {
        let data = try JSONEncoder().encode(grant)
        let status = SecItemUpdate(
            item(accountID) as CFDictionary,
            [kSecValueData as String: data] as CFDictionary,
        )
        guard status == errSecItemNotFound else { return try check(status) }
        var attributes = item(accountID)
        attributes[kSecValueData as String] = data
        // Re-authorizing costs an OAuth round-trip, so the grant has to survive a reboot into a
        // locked screen. It never has to leave this Mac: a token is per-machine (ADR-0018).
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        try check(SecItemAdd(attributes as CFDictionary, nil))
    }

    /// An entry that will not decode reads as no grant, not as an error: a throw would be a launch
    /// that fails on a keychain entry the user cannot see to fix.
    public func grant(for accountID: String) async throws -> AccountGrant? {
        var query = item(accountID)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status != errSecItemNotFound else { return nil }
        try check(status)
        guard let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(AccountGrant.self, from: data)
    }

    /// Removing an Account that was never granted is a success: the post-condition asked for is
    /// "no entry for this Account", and there is none.
    public func removeGrant(for accountID: String) async throws {
        let status = SecItemDelete(item(accountID) as CFDictionary)
        guard status != errSecItemNotFound else { return }
        try check(status)
    }

    private func item(_ accountID: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: accountID,
        ]
    }

    private func check(_ status: OSStatus) throws {
        guard status != errSecSuccess else { return }
        throw KeychainGrantError.keychain(
            status: status,
            message: SecCopyErrorMessageString(status, nil) as String? ?? "",
        )
    }
}

public enum KeychainGrantError: Error, Equatable {
    case keychain(status: OSStatus, message: String)
}
