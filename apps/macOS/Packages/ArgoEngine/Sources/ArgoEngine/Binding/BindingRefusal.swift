import Foundation

/// Why a bind did not happen — and therefore what the user has to change.
///
/// Every case is raised *before* anything is written. That is the whole argument for validating at
/// bind time: after it, an Account that cannot see the scope is indistinguishable from a scope with
/// nothing in it, and the only moment the two are separable has passed (ADR-0018).
public enum BindingRefusal: Error, Equatable {
    /// Binding is a choice about a Project, and a Project is created by registration alone.
    case noSuchProject
    case noSuchAccount
    /// Linear issues grants for Work Items and nothing else, so a Linear Account cannot fill the
    /// code-host port. Refused here rather than at the first read, where it would arrive as a
    /// provider that answers nothing.
    case portNotServedByProvider(AccountProvider, AccountPort)
    /// The Account is listed but its token is not in the keychain — the half-state a failed grant
    /// or a keychain reset leaves behind.
    case noGrant
    case grantExpired
    /// The Account authenticated, and this scope is not among what it can see.
    case scopeNotVisible(String)
    /// The grant itself was refused. Account-level, so re-authorizing is the fix and re-binding is
    /// not.
    case unauthorized
    /// The provider could not be asked. Not a verdict on the scope, so nothing is recorded and
    /// nothing is permanently refused.
    case unreadable(String)
}

/// Why a Binding that was recorded can no longer be read through.
///
/// Separate from `BindingRefusal` because the two are answered at different moments and have
/// different fixes: a refusal is a bind that never happened, a fault is a Binding on disk whose
/// Account has since gone. Sharing one enum would let `scopeNotVisible` appear where nothing checks
/// scopes.
public enum BindingFault: Equatable, Sendable {
    /// The Account was removed (#566) while this Binding still named it. Reported rather than
    /// silently dropped, which is what makes the Binding re-bindable instead of an empty read.
    case accountRemoved
    case grantMissing
    case grantExpired
}
