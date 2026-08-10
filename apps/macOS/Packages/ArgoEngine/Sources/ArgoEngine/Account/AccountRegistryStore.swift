import Foundation

/// The per-machine Account registry file, and the only thing that writes it.
///
/// Owned state, never committed — a grant is per machine, so this sits beside `projects.json` in
/// application support rather than anywhere under a repository. Every mutation reads, transitions
/// and writes in one hop on the actor, so two windows completing a grant at once cannot lose one
/// another's Account.
///
/// The file holds **no token**. The grant goes to `AccountGrantStore`, keyed by the same
/// `AccountRecord.id` this file records, and the two are kept in step by this type alone.
public actor AccountRegistryStore {
    public static let defaultFileURL = URL.applicationSupportDirectory
        .appending(path: "Argo", directoryHint: .isDirectory)
        .appending(path: "accounts.json")

    private let fileURL: URL
    private let grants: AccountGrantStore
    private let bindings: AccountBindingIndex

    public init(
        fileURL: URL = AccountRegistryStore.defaultFileURL,
        grants: AccountGrantStore = KeychainGrantStore(),
        bindings: AccountBindingIndex = NoAccountBindings(),
    ) {
        self.fileURL = fileURL
        self.grants = grants
        self.bindings = bindings
    }

    /// A registry that cannot be read is an empty one: a machine that never authorized, a
    /// half-written file, a hand-edit gone wrong. Launching unconnected is recoverable — it is the
    /// state before onboarding — while refusing to launch is not.
    public func load() -> AccountRegistry {
        guard let data = try? Data(contentsOf: fileURL),
              let registry = try? JSONDecoder().decode(AccountRegistry.self, from: data)
        else { return .empty }
        return registry
    }

    /// Record a completed grant. The identity is keyed on the provider's own id, so authorizing an
    /// Account already held updates its name and replaces its token rather than adding a second.
    ///
    /// The token is written **before** the record, and the order is load-bearing: a keychain entry
    /// with no record is invisible and is overwritten by the next grant for that identity, while a
    /// record with no token is an Account that renders as connected and cannot read anything.
    @discardableResult
    public func authorize(
        _ account: AccountRecord,
        grant: AccountGrant,
    ) async throws
        -> AccountRegistry {
        try await grants.store(grant, for: account.id)
        return persist(load().authorizing(account))
    }

    public func grant(for accountID: String) async throws -> AccountGrant? {
        try await grants.grant(for: accountID)
    }

    /// What removing this Account would leave pointing at nothing, without removing it. The
    /// question a confirmation prompt has to answer before the user says yes.
    public func orphans(of accountID: String) async -> [AccountBindingReference] {
        await bindings.bindings(referencing: accountID)
    }

    /// Forget an Account and drop its token, reporting the Bindings that named it.
    ///
    /// A keychain deletion that fails stops the removal: the record stays, so the Account is still
    /// listed and still removable. Dropping the record anyway would leave a token on the machine
    /// that nothing in Argo can any longer see, let alone delete.
    @discardableResult
    public func remove(id accountID: String) async throws -> AccountRemoval {
        let removed = load().account(id: accountID)
        let orphaned = await orphans(of: accountID)
        try await grants.removeGrant(for: accountID)
        return AccountRemoval(
            registry: persist(load().removing(id: accountID)),
            removed: removed,
            orphaned: orphaned,
        )
    }

    /// A registry that cannot be written is still the registry this process will use: the grant
    /// holds for this launch and is forgotten by the next one, which is a better answer to a full
    /// disk than refusing an authorization the provider has already granted.
    private func persist(_ registry: AccountRegistry) -> AccountRegistry {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
            )
            try encoder.encode(registry).write(to: fileURL, options: .atomic)
        } catch {
            // Nothing to recover: the registry below is the answer either way.
        }
        return registry
    }
}
