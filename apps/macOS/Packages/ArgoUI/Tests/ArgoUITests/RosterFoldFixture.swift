import ArgoEngine
@testable import ArgoUI

/// The caption loop the fold suites project from: near-identical headless runs sharing one folder,
/// which is the roster #1073 was measured on.
///
/// Shared rather than repeated per suite, for the reason `RosterSessionFixture` is: two copies of
/// a fixture drift into two different ideas of what a run is.
enum RosterFoldFixture {
    static let loop = "\(RosterSessionFixture.checkout)/docs/designs/prototypes"
    static let otherLoop = "\(RosterSessionFixture.checkout)/docs/designs/captions"

    static func runs(
        _ count: Int,
        at directory: String?,
        entry: SessionEntry = .headless,
        from first: Int = 0,
    )
        -> [CockpitPresentation.Session] {
        (first ..< first + count).map { run(at: directory, entry: entry, index: $0) }
    }

    /// One run. `external` because that is what every headless run on a real roster is: nobody
    /// spawned it from Argo, so Argo owns no terminal for it.
    static func run(
        at directory: String?,
        entry: SessionEntry = .headless,
        index: Int = 0,
        access: CockpitPresentation.Session.Access = .external,
        isArchived: Bool = false,
    )
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(
            id: "run-\(index)",
            title: "Write the caption",
            workspaceLocation: directory,
            access: access,
            entry: entry,
            // Newest first, the order the Hub publishes in.
            lastSeenAtMs: 9_000_000 - index,
            isArchived: isArchived,
        )
    }
}
