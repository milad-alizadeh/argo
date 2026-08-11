@testable import ArgoEngine
import Foundation

/// A throwaway machine with both halves of the split on it: a Project registry and an Account
/// registry, in two files that know nothing about each other.
///
/// Both are real files in real temporary folders. The only substitutions are the two dependencies
/// the suite genuinely cannot reach — the login keychain (`AccountFixture`) and the provider's API.
struct BindingFixture {
    let projects: ProjectFixture
    let accounts: AccountFixture
    let scopeCheck = RecordingScopeCheck()

    init() throws {
        let projects = try ProjectFixture()
        self.projects = projects
        self.accounts = try AccountFixture(
            bindings: ProjectBindingIndex(projects: projects.store()),
        )
    }

    func remove() {
        projects.remove()
        accounts.remove()
    }

    /// The registries wired together the way the app wires them: the Account store's answer to
    /// "what would this removal orphan" comes from the Project registry this fixture owns.
    func accountStore() -> AccountRegistryStore {
        AccountRegistryStore(
            fileURL: accounts.registryFileURL,
            grants: accounts.grants,
            bindings: ProjectBindingIndex(projects: projects.store()),
        )
    }

    func bindings(scopeCheck: BindingScopeCheck? = nil) -> ProjectBindings {
        ProjectBindings(
            projects: projects.store(),
            accounts: accountStore(),
            scopeCheck: scopeCheck ?? self.scopeCheck,
        )
    }

    /// A registered git repository, by the id every Binding is addressed with.
    func project(_ name: String) async throws -> String {
        let url = try projects.folder(name, git: true)
        guard let id = await projects.store().register(at: url).project?.id else {
            throw ProjectMissing()
        }
        return id
    }

    /// Which provider a Project's Work Item port actually resolves to, and which token it carries.
    /// Read through `resolve` rather than off the registry, because resolving is what a reader does
    /// and the token is the only thing two Accounts of one provider differ by.
    func provider(of projectID: String) async -> AccountProvider? {
        await ready(projectID)?.provider
    }

    func token(of projectID: String) async -> String? {
        await ready(projectID)?.grant.accessToken
    }

    private func ready(_ projectID: String) async -> ResolvedBinding? {
        guard case let .ready(resolved) = await bindings()
            .resolve(port: .workItem, for: projectID) else { return nil }
        return resolved
    }

    struct ProjectMissing: Error {}
}

extension AccountRegistryStore {
    /// A Linear identity in the registry. Nothing issues one yet — the grant is #371's — but the
    /// registry is provider-agnostic by construction, and a Binding to Linear has to be expressible
    /// before the adapter that reads through it exists.
    @discardableResult
    func authorizeLinear(id providerAccountID: String, token: String) async throws
        -> AccountRegistry {
        try await authorize(
            AccountRecord(
                provider: .linear,
                providerAccountID: providerAccountID,
                displayName: "milad",
            ),
            grant: AccountGrant(accessToken: token, scopes: ["read", "write"]),
        )
    }
}

extension ProjectBinding {
    static func gitHub(
        port: AccountPort = .workItem,
        account: String = "github:1",
        scope: String = "milad-alizadeh/argo",
    )
        -> ProjectBinding {
        ProjectBinding(port: port, accountID: account, scope: scope)
    }
}

/// The provider, with its verdict decided in advance and every question it was asked remembered.
///
/// Recording the token is what makes "no cross-talk" observable: two Projects on two Accounts of
/// one provider differ in nothing else, so a test that only checked the verdict would pass with the
/// tokens swapped.
actor RecordingScopeCheck: BindingScopeCheck {
    struct Question: Equatable {
        let provider: AccountProvider
        let scope: String
        let token: String
    }

    private var verdicts: [String: ScopeVisibility] = [:]
    private var asked: [Question] = []

    func answer(_ visibility: ScopeVisibility, for scope: String) {
        verdicts[scope] = visibility
    }

    func visibility(of probe: BindingProbe) -> ScopeVisibility {
        asked.append(Question(
            provider: probe.provider,
            scope: probe.scope,
            token: probe.grant.accessToken,
        ))
        return verdicts[probe.scope] ?? .visible
    }

    func questions() -> [Question] {
        asked
    }
}

/// One canned provider response, and every request that reached it.
///
/// Single-shot rather than a queue because a scope check is one request: a queue would let a test
/// pass by answering the *next* request when the check made none at all.
actor StubProviderAPI: HTTPTransport {
    private let body: String
    private let failure: HTTPTransportError?
    private var requests: [HTTPRequest] = []

    init(body: String = "{}", failure: HTTPTransportError? = nil) {
        self.body = body
        self.failure = failure
    }

    func send(_ request: HTTPRequest) throws -> Data {
        requests.append(request)
        if let failure {
            throw failure
        }
        return Data(body.utf8)
    }

    func urls() -> [String] {
        requests.map(\.url)
    }

    func bearerTokens() -> [String] {
        requests.compactMap(\.bearerToken)
    }

    func jsonBodies() -> [Data] {
        requests.compactMap {
            guard case let .json(data) = $0.body else { return nil }
            return data
        }
    }
}
