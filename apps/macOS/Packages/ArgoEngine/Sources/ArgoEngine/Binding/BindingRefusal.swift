import Foundation

/// Why a bind did not happen — and therefore what the user has to change. Every case is raised
/// *before* anything is written: after it, an Account that cannot see the scope is
/// indistinguishable from a scope with nothing in it (ADR-0018).
public enum BindingRefusal: Error, Equatable {
    /// Binding is a choice about a Project, and a Project is created by registration alone.
    case noSuchProject
    case noSuchAccount
    /// Linear issues grants for Work Items and nothing else, so a Linear Account cannot fill the
    /// code-host port.
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

/// Why a Binding that was recorded can no longer be read through — a fault is a Binding on disk
/// whose Account has since gone, where a `BindingRefusal` is a bind that never happened.
public enum BindingFault: Equatable, Sendable {
    /// The Account was removed (#566) while this Binding still named it. Reported rather than
    /// silently dropped, which is what makes the Binding re-bindable instead of an empty read.
    case accountRemoved
    /// A Binding `bind` would have refused, so it was written by something else — a hand edit, or a
    /// build that once allowed it. The registry is not a trusted input.
    case portNotServedByProvider
    case grantMissing
    case grantExpired
}
