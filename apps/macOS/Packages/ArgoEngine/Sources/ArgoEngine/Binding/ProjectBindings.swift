import Foundation

/// Choosing which Account a Project reads each port through — the only public way a Binding is
/// made, unmade, or read.
///
/// Both registries, because the two acts differ: **authorizing** is Account-level and happened once
/// per identity per machine, **choosing** is Binding-level and happens per Project. Nothing here
/// can reach a grant flow, so binding a second Project performs no OAuth round-trip at all.
public actor ProjectBindings {
    private let projects: ProjectRegistryStore
    private let accounts: AccountRegistryStore
    private let scopeCheck: BindingScopeCheck
    private let catalog: BindingScopeCatalog

    public init(
        projects: ProjectRegistryStore,
        accounts: AccountRegistryStore,
        seams: BindingProviderSeams = BindingProviderSeams(),
    ) {
        self.projects = projects
        self.accounts = accounts
        self.scopeCheck = seams.scopeCheck
        self.catalog = seams.catalog
    }

    /// Bind a port, having first asked the provider whether this Account can see the scope. Nothing
    /// is written unless the answer is yes, so no refusal leaves a Binding behind.
    @discardableResult
    public func bind(_ binding: ProjectBinding, to projectID: String) async throws
        -> ProjectBinding {
        let registry = await projects.load()
        guard registry.project(id: projectID) != nil else { throw BindingRefusal.noSuchProject }
        let account = try await account(binding.accountID, filling: binding.port)
        let grant = try await grant(for: account)
        switch await scopeCheck.visibility(of: BindingProbe(
            binding: binding,
            provider: account.provider,
            grant: grant,
        )) {
        case .visible: break
        case .notVisible: throw BindingRefusal.scopeNotVisible(binding.scope)
        case .unauthorized: throw BindingRefusal.unauthorized
        case let .unreadable(reason): throw BindingRefusal.unreadable(reason)
        }
        await projects.bind(binding, to: projectID)
        return binding
    }

    /// What this Account could be bound to through this port, asked of the provider. The offer side
    /// of `bind`: it names the scopes rather than checking one, and it decides nothing — a scope
    /// picked from this list still goes through `bind`, which is the only thing that records one.
    public func scopes(on port: AccountPort, through accountID: String) async -> ScopeCatalogue {
        guard let account = try? await account(accountID, filling: port) else {
            return .unreadable("That account cannot fill this connection.")
        }
        guard let grant = try? await grant(for: account) else { return .unauthorized }
        return await catalog.scopes(for: ScopeQuery(
            port: port,
            provider: account.provider,
            grant: grant,
        ))
    }

    /// The same resolve for a window that may be on no Project at all. `unbound` rather than a
    /// refusal: with no Project there is nothing this port reads through, which is what unbound
    /// says.
    public func resolve(
        port: AccountPort,
        forProject projectID: String?,
    ) async
        -> BindingResolution {
        guard let projectID else { return .unbound }
        return await resolve(port: port, for: projectID)
    }

    /// Give one port back to unbound, leaving the other where it is.
    public func unbind(port: AccountPort, from projectID: String) async {
        await projects.unbind(port: port, from: projectID)
    }

    /// What this Project reads one port through, right now — including the cases where the answer
    /// is "nothing", and where it is "something that has come undone".
    public func resolve(port: AccountPort, for projectID: String) async -> BindingResolution {
        guard let binding = await projects.load().binding(on: port, of: projectID) else {
            return .unbound
        }
        guard let account = await accounts.load().account(id: binding.accountID) else {
            return .broken(binding, .accountRemoved)
        }
        // `bind` refuses this, so reaching it means the file was hand-edited: the registry is not a
        // trusted input, and the alternative is reading Delivery truth off a Ticket provider.
        guard account.provider.serves(port) else {
            return .broken(binding, .portNotServedByProvider)
        }
        guard let grant = try? await accounts.grant(for: binding.accountID) else {
            return .broken(binding, .grantMissing)
        }
        guard !grant.isExpired(asOf: Date()) else { return .broken(binding, .grantExpired) }
        return .ready(ResolvedBinding(binding: binding, account: account, grant: grant))
    }

    private func account(_ accountID: String, filling port: AccountPort) async throws
        -> AccountRecord {
        guard let account = await accounts.load().account(id: accountID) else {
            throw BindingRefusal.noSuchAccount
        }
        guard account.provider.serves(port) else {
            throw BindingRefusal.portNotServedByProvider(account.provider, port)
        }
        return account
    }

    /// The token, or the refusal that a listed Account with no usable one is. An unreadable
    /// keychain is `noGrant` rather than a thrown error — either way there is nothing to bind with.
    private func grant(for account: AccountRecord) async throws -> AccountGrant {
        guard let grant = try? await accounts.grant(for: account.id) else {
            throw BindingRefusal.noGrant
        }
        guard !grant.isExpired(asOf: Date()) else { throw BindingRefusal.grantExpired }
        return grant
    }
}
