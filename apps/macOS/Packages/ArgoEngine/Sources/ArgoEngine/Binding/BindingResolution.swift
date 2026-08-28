import Foundation

/// A Binding with the identity and the token it names, ready to read through. The grant is carried
/// rather than looked up: two Projects on two Accounts of the *same* provider differ in nothing but
/// this token, so a reader fetching it elsewhere can cross the two over.
public struct ResolvedBinding: Sendable {
    public let binding: ProjectBinding
    public let account: AccountRecord
    public let grant: AccountGrant

    public init(binding: ProjectBinding, account: AccountRecord, grant: AccountGrant) {
        self.binding = binding
        self.account = account
        self.grant = grant
    }

    public var provider: AccountProvider {
        account.provider
    }
}

/// What a Project's port is, asked at read time.
///
/// `unbound` is a first-class answer and not an error: it is what a fully-onboarded machine reaches
/// when a Project simply has no Ticket provider, and the cockpit renders "no Tickets" for it
/// rather than a failure (CONTEXT.md L1 · Binding).
public enum BindingResolution: Sendable {
    case unbound
    case ready(ResolvedBinding)
    /// A Binding that exists and cannot be read through, naming why. Never collapsed into
    /// `unbound`: a decision that has come undone must say so to be re-bindable.
    case broken(ProjectBinding, BindingFault)
}
