import Foundation

/// What Argo asks a provider before it records a Binding: can this identity, holding this grant,
/// read this scope **through this port**?
///
/// The port is part of the question and not context around it. One GitHub repository can be
/// perfectly visible and still have Issues switched off, and a Work Item Binding to it reads empty
/// forever — the same silence a scope the Account cannot see produces, and the one bind time exists
/// to tell apart.
public struct BindingProbe: Sendable {
    public let binding: ProjectBinding
    public let provider: AccountProvider
    public let grant: AccountGrant

    public init(binding: ProjectBinding, provider: AccountProvider, grant: AccountGrant) {
        self.binding = binding
        self.provider = provider
        self.grant = grant
    }

    public var scope: String {
        binding.scope
    }

    public var port: AccountPort {
        binding.port
    }
}

/// The provider's answer, in the only three shapes a bind-time decision can use.
///
/// `unreadable` is its own case and not a `notVisible`: a provider that is down has not said the
/// Account cannot see the scope, and recording a Binding on that reading — or refusing one
/// permanently — both claim more than was observed. It refuses *this* attempt and says why
/// (CONTEXT.md, the degrade-down rule).
public enum ScopeVisibility: Equatable, Sendable {
    case visible
    case notVisible
    /// The grant itself was refused: revoked, expired, or never good for this provider. An
    /// Account-level failure, whose blast radius is every Binding naming that Account.
    case unauthorized
    case unreadable(String)
}

/// The seam bind-time validation reads through.
///
/// It exists as a protocol for the same reason `HTTPTransport` does — the suite has no business
/// reaching GitHub — but also because it is the one place a new provider has to appear. An adapter
/// that cannot answer this question cannot be bound, and that is the correct refusal: without it,
/// every read through the Binding 404s and reads as "the ticket does not exist" (ADR-0018).
public protocol BindingScopeCheck: Sendable {
    func visibility(of probe: BindingProbe) async -> ScopeVisibility
}

/// Routes a probe to the adapter that speaks its provider.
///
/// The `switch` is exhaustive over `AccountProvider`, so adding a third provider fails the build
/// here rather than shipping a Binding nothing validates.
public struct ProviderScopeCheck: BindingScopeCheck {
    private let github: BindingScopeCheck
    private let linear: BindingScopeCheck

    public init(transport: HTTPTransport = URLSessionTransport()) {
        self.github = GitHubScopeCheck(transport: transport)
        self.linear = LinearScopeCheck(transport: transport)
    }

    public func visibility(of probe: BindingProbe) async -> ScopeVisibility {
        switch probe.provider {
        case .github: await github.visibility(of: probe)
        case .linear: await linear.visibility(of: probe)
        }
    }
}
