import Foundation

/// The three readings one Session's gate owns, as one value (#634).
///
/// They move together on purpose: what is waiting, what has stopped asking, and what Argo's own
/// clock refused all change on the same acts, and a caller handed three separate publishes has to
/// keep them in step itself. `ClaimLedger.withdraw` already treats them as one thing for the same
/// reason.
struct GateReadings: Equatable {
    var waiting: [PermissionRequest] = []
    var standing: [StandingAllow] = []
    var expiries: [PermissionExpiry] = []
}
