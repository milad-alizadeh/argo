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
    private static let aMinute = 60000
    private static let firstStartedAtMs = 8_000_000

    static func runs(
        _ count: Int,
        at directory: String?,
        entry: SessionEntry = .headless,
        from first: Int = 0,
        status: SessionStatus = .idle,
    )
        -> [CockpitPresentation.Session] {
        (first ..< first + count).map {
            run(
                at: directory, entry: entry, index: $0, status: status,
                // A minute apart, which is what a `-p` loop's runs actually are: the one fact
                // that tells two of them apart when the prompt behind them is one template.
                startedAtMs: Self.firstStartedAtMs + $0 * Self.aMinute,
            )
        }
    }

    /// One run. `external` because that is what every headless run on a real roster is: nobody
    /// spawned it from Argo, so Argo owns no terminal for it.
    static func run(
        at directory: String?,
        entry: SessionEntry = .headless,
        index: Int = 0,
        access: CockpitPresentation.Session.Access = .external,
        isArchived: Bool = false,
        status: SessionStatus = .idle,
        startedAtMs: Int? = nil,
    )
        -> CockpitPresentation.Session {
        RosterSessionFixture.session(
            id: "run-\(index)",
            title: "Write the caption",
            workspaceLocation: directory,
            access: access,
            entry: entry,
            status: status,
            // Newest first, the order the Hub publishes in.
            lastSeenAtMs: 9_000_000 - index,
            startedAtMs: startedAtMs,
            isArchived: isArchived,
        )
    }
}
