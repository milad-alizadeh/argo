@testable import ArgoEngine
import Foundation

/// A throwaway machine: a registry file that does not exist yet, and a grant store standing in for
/// the login keychain.
///
/// The keychain is the one dependency the suite substitutes, and only because a `swift test` binary
/// is unsigned and so has no keychain of its own to write to — a real `SecItem` call here either
/// prompts whoever is at the machine or fails on the runner. Everything the registry itself does
/// runs for real, against a real file.
struct AccountFixture {
    let rootURL: URL
    let grants = RecordingGrantStore()
    private let bindings: AccountBindingIndex

    init(bindings: AccountBindingIndex = NoAccountBindings()) throws {
        self.bindings = bindings
        self.rootURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-accounts-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    var registryFileURL: URL {
        rootURL.appending(path: "Argo/accounts.json")
    }

    func store(grants: AccountGrantStore? = nil) -> AccountRegistryStore {
        AccountRegistryStore(
            fileURL: registryFileURL,
            grants: grants ?? self.grants,
            bindings: bindings,
        )
    }

    func writeRegistryFile(_ contents: String) throws {
        try FileManager.default.createDirectory(
            at: registryFileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true,
        )
        try contents.write(to: registryFileURL, atomically: true, encoding: .utf8)
    }

    func readRegistryFile() throws -> String {
        try String(contentsOf: registryFileURL, encoding: .utf8)
    }

    static func github(id providerAccountID: String, login: String) -> AccountRecord {
        AccountRecord(
            provider: .github,
            providerAccountID: providerAccountID,
            displayName: login,
        )
    }
}

extension AccountRegistryStore {
    /// A completed GitHub grant, which is where most of these tests start rather than what they are
    /// about. Named parameters only where a test's claim turns on them.
    @discardableResult
    func authorizeGitHub(
        id providerAccountID: String,
        login: String = "milad",
        token: String = "ghu_personal",
    ) async throws
        -> AccountRegistry {
        try await authorize(
            AccountFixture.github(id: providerAccountID, login: login),
            grant: AccountGrant(accessToken: token, scopes: GitHubOAuthApp.scopes),
        )
    }
}

/// The keychain's stand-in: holds what it was handed, so a test can ask what is under an Account
/// rather than assert that a method was called.
actor RecordingGrantStore: AccountGrantStore {
    private var grants: [String: AccountGrant] = [:]

    func store(_ grant: AccountGrant, for accountID: String) {
        grants[accountID] = grant
    }

    func grant(for accountID: String) -> AccountGrant? {
        grants[accountID]
    }

    func removeGrant(for accountID: String) {
        grants[accountID] = nil
    }

    func accountIDs() -> [String] {
        grants.keys.sorted()
    }
}

/// A keychain that refuses to delete — the case where dropping the token fails and the record must
/// therefore stay, so the Account is still listed and still removable.
struct UndeletableGrantStore: AccountGrantStore {
    struct Refused: Error {}

    func store(_: AccountGrant, for _: String) {}
    func grant(for _: String) -> AccountGrant? {
        nil
    }

    func removeGrant(for _: String) throws {
        throw Refused()
    }
}

/// A machine where Bindings already name Accounts, so a removal has something to orphan.
struct StubBindingIndex: AccountBindingIndex {
    let bindings: [String: [AccountBindingReference]]

    func bindings(referencing accountID: String) async -> [AccountBindingReference] {
        bindings[accountID] ?? []
    }
}
