import Foundation

/// A Binding with the identity and the token it names, ready to read through.
///
/// The grant is carried rather than looked up again by whoever reads: two Projects bound to two
/// Accounts of the *same* provider differ in nothing but this token, so a reader that fetched it
/// from anywhere but the Binding is a reader that can cross the two over.
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
/// `unbound` is a first-class answer and not an error, because it is the state a fully-onboarded
/// machine reaches whenever a Project simply has no Work Item provider — the cockpit renders "no
/// Work Items" for it, and would render a failure for anything else (CONTEXT.md L1 · Binding).
public enum BindingResolution: Sendable {
    case unbound
    case ready(ResolvedBinding)
    /// A Binding that exists and cannot be read through, naming why. Never collapsed into
    /// `unbound`: a port whose Account was removed is a port with a decision on it that has come
    /// undone, and telling the user so is what makes it re-bindable.
    case broken(ProjectBinding, BindingFault)
}
