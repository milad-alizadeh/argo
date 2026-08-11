import Foundation

/// What Argo has observed about each Binding's connection, and the one place that answers how a
/// port is doing.
///
/// **Nothing here is persisted.** Health is a live reading, entirely rebuilt by the next poll, and
/// a launch that inherited yesterday's failures would open on a chip claiming something it has not
/// observed since — the degrade-down rule pointed at Argo's own record.
///
/// **Nothing here holds fetched data either**, and that is what keeps the failure spec's first rule
/// true by construction rather than by care: a failed poll cannot blank a ticket list this type has
/// never seen. What it records is the connection; what was fetched stays where it was, old and
/// still accurately DERIVED.
///
/// The two levels are stored the way they fail. A binding-level cause is filed under the Binding it
/// happened to; an account-level refusal is filed under the **Account**, once, and the blast radius
/// is derived by every Binding that names it asking. Fanning a refusal out into N records would
/// leave one act of reconnecting with N records to find and clear.
public actor ConnectionHealthLedger {
    private var reads: [AccountBindingReference: Reading] = [:]
    private var refused: Set<String> = []

    public init() {}

    /// A read landed. Clears the Binding's own cause, and the Account's refusal too: a read that
    /// went through is proof the grant works, and proof outranks the record of a refusal.
    public func succeeded(_ binding: ProjectBinding, in projectID: String, at now: Date) {
        refused.remove(binding.accountID)
        reads[reference(binding, projectID)] = Reading(lastSuccess: now, cause: nil)
    }

    /// A read did not land, for a reason that says nothing about the grant. Binding-level, so it
    /// takes one port of one Project with it and leaves every other Binding on that Account
    /// reading.
    public func failed(_ binding: ProjectBinding, in projectID: String, cause: ConnectionCause) {
        let key = reference(binding, projectID)
        reads[key] = Reading(lastSuccess: reads[key]?.lastSuccess, cause: cause)
    }

    /// The provider refused the grant itself. Account-level: recorded once against the identity,
    /// which is what makes the blast radius every Binding naming it and no Binding naming another
    /// Account of the same provider.
    public func grantRefused(_ accountID: String) {
        refused.insert(accountID)
    }

    /// The grant is good again. One act, and every Binding that named this Account reads again —
    /// there is one record to clear because there was one to write.
    ///
    /// Raised both by the user obtaining a grant and by a resolution finding the one on file
    /// present and unexpired. The two are the same claim about the same fact, and a record only the
    /// first could clear would leave the chip lit over a connection that had started working.
    public func reconnected(_ accountID: String) {
        refused.remove(accountID)
    }

    /// How this Binding is doing, both levels folded into one answer.
    ///
    /// The account level wins where both are failing, because its fix is the other's prerequisite:
    /// rebinding a scope through a token the provider has stopped accepting is refused at bind
    /// time.
    public func health(of binding: ProjectBinding, in projectID: String) -> BindingHealth {
        let reading = reads[reference(binding, projectID)]
        guard !refused.contains(binding.accountID) else {
            return BindingHealth(fault: .grantRefused, lastSuccess: reading?.lastSuccess)
        }
        return BindingHealth(
            fault: reading?.cause.map(ConnectionFault.read),
            lastSuccess: reading?.lastSuccess,
        )
    }

    private func reference(
        _ binding: ProjectBinding,
        _ projectID: String,
    )
        -> AccountBindingReference {
        AccountBindingReference(projectID: projectID, port: binding.port)
    }

    /// One Binding's read history, which is two facts that outlive each other in opposite
    /// directions: a cause is cleared by the next success, and a success survives every later
    /// failure.
    private struct Reading {
        let lastSuccess: Date?
        let cause: ConnectionCause?
    }
}
