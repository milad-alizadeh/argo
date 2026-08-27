import Foundation

/// What each Project's Work Item port last answered with, and the only place a listing lives.
///
/// **Nothing here is persisted** (ADR-0008). A Work Item's content is the provider's, read through
/// and cached for as long as the app runs; a launch that opened on yesterday's listing would be
/// rendering a DIRECT-looking claim about a read it has not made.
///
/// A listing is REPLACED whole or left alone, never merged. That is what makes the failure rule
/// true by construction rather than by care: the poll records only what it read, so a refused or
/// throttled read cannot empty a room that was full a second ago.
public actor WorkItemLedger {
    private var listings: [String: [WorkItem]] = [:]

    public init() {}

    public func record(_ items: [WorkItem], for projectID: String) {
        listings[projectID] = items
    }

    /// The listing, and an empty one for a Project nothing has read yet — which reads the same as
    /// a repository with no issues, because from a surface's side they are the same: no Work Items
    /// to show, and the health chip is what says whether that is an answer or a silence.
    public func items(of projectID: String) -> [WorkItem] {
        listings[projectID] ?? []
    }
}
