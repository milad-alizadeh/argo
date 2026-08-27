import Foundation

/// What each Project's Work Item port last answered with, and the only place a listing lives.
///
/// **Nothing here is persisted** (ADR-0008): a launch that opened on yesterday's listing would be
/// a DIRECT-looking claim about a read it has not made. A listing is replaced whole or left alone,
/// never merged, which is what stops a failed poll emptying a room that was full a second ago.
public actor WorkItemLedger {
    private var listings: [String: [WorkItem]] = [:]

    public init() {}

    public func record(_ items: [WorkItem], for projectID: String) {
        listings[projectID] = items
    }

    /// The listing, and an empty one for a Project nothing has read yet — which reads the same as
    /// a repository with no issues, because from a surface's side they are the same: no Work Items
    /// to show, and the health chip is what says whether that is an answer or a silence.
    ///
    /// No Project at all reads empty on the same terms, and never the last one's listing: a window
    /// pointed away from a Project must not go on drawing its backlog.
    public func items(of projectID: String?) -> [WorkItem] {
        projectID.flatMap { listings[$0] } ?? []
    }
}
