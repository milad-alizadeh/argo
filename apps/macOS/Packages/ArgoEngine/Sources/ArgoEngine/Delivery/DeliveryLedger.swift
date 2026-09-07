import Foundation

/// What each Project's code host last answered with, keyed by branch, and the only place a Delivery
/// lives.
///
/// Nothing here is persisted (ADR-0008, ADR-0017).
public actor DeliveryLedger {
    private var derived: [String: [Delivery]] = [:]

    public init() {}

    /// Record what one derivation established, keeping the Delivery of every branch it did not
    /// reach (#1617).
    ///
    /// Merged HERE rather than assembled in the derivation, because reading this ledger and writing
    /// back to it are two hops and `DeliveryDerivation.derive` is reentrant: the poll's tick and
    /// the
    /// socket's derivation are both live on it, measured twice inside the same second. The one that
    /// read first can be the one that records last, so an assembled merge records over a mark the
    /// other had just established. Under this actor the read and the write are one step.
    ///
    /// Every branch outside `established` keeps what it had because the in-flight listing is
    /// bounded
    /// by what is OPEN: every merged Delivery comes from the fan-out over a local half asked for at
    /// the moment of the tick, and that half is not a constant — an instrumented build derived
    /// against `Locally.workspaces` of length 0 while another derived against 33, and a refusal at
    /// the third branch of fifty-five reaches none of the rest (#1546, #1588, #1617).
    ///
    /// Kept in BRANCH order, so the recorded list is a function of the set rather than of which
    /// branches the tick happened to see. `DeliveryReadings.read` publishes on array inequality,
    /// and
    /// a local half that alternates would otherwise rebuild the whole shell every tick with nothing
    /// on screen moving — #858, one poll over.
    ///
    /// A branch that is genuinely gone therefore keeps its Delivery for the life of the window. The
    /// one surface that reads these joins by branch off a Workspace that no longer exists
    /// (`CockpitPresentation.Readings.pullRequest(forBranch:)`), so nothing draws it.
    public func record(_ established: [Delivery], for projectID: String) {
        let reached = Set(established.map(\.branch))
        let kept = deliveries(of: projectID).filter { !reached.contains($0.branch) }
        derived[projectID] = (established + kept).sorted { $0.branch < $1.branch }
    }

    /// Every Delivery derived for a Project, and none for a Project nothing has read yet — the
    /// health chip is what says whether that is an answer or a silence. No Project at all reads
    /// empty too, and never the last one's.
    public func deliveries(of projectID: String?) -> [Delivery] {
        projectID.flatMap { derived[$0] } ?? []
    }

    /// The one Delivery a branch is the life of, which is what every other layer joins by
    /// (`CONTEXT.md` L3 · Workspace).
    public func delivery(ofBranch branch: String, in projectID: String?) -> Delivery? {
        deliveries(of: projectID).first { $0.branch == branch }
    }
}
