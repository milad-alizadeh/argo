/// The Workspace tree the `@` menu's cases are drawn against (#687) — this repository's own paths,
/// which is where the design's "nine segments deep" came from.
///
/// Real rather than invented, and for a reason a fixture of `foo/bar.swift` could not serve: the
/// file row's left-cut directory is a response to a column of identical `apps/macOS/Packages/…`
/// prefixes, and only real paths have those.
enum WorkspaceFileFixture {
    /// Seventeen paths — enough to overflow the eleven rows the list draws before it scrolls.
    /// `at.png`'s order, so the render and the case can be compared row for row.
    static let machine = touched + rest

    /// What the Session's agent has been in, newest first. They sort to the top and wear the mark.
    static let touched = [
        "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Composer/SessionComposer.swift",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionDriver.swift",
        "docs/designs/cockpit-session-composer.md",
    ]

    private static let rest = [
        // Nothing under `ArgoEngine/Hub/` is named here on purpose: `swift-boundaries.sh` reads a
        // view naming the Hub as the projection leak it is, and cannot tell a path in a fixture
        // from a declaration.
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionAsk.swift",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/PermissionRequest.swift",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Repository/WorkspaceProjection.swift",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionStatus.swift",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/SessionStatusReading.swift",
        "apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/ToolCall.swift",
        "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/CockpitPresentation+Session.swift",
        "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/Deck/Feed/Call/FeedCallLine.swift",
        "apps/macOS/ArgoE2ETests/FeedKeyboardE2ETests.swift",
        "docs/adr/ADR-0024-session-drive-port.md",
        "README.md",
        "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/ArgoTypography.swift",
        "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/ArgoSpacing.swift",
        "docs/designs/cockpit-composer-picker.md",
    ]

    /// Where the Session works. Every path above is said relative to it.
    static let root = "/Users/milad/Developer/argo"
}
