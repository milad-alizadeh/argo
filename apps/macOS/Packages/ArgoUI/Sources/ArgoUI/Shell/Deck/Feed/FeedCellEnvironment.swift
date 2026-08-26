import ArgoEngine
import SwiftUI

/// What crosses the hosting boundary into a feed cell, named value by value.
///
/// An `NSHostingView` inherits nothing from the hierarchy above it, so the cockpit's environment
/// has to be replayed into every cell. It is replayed by NAME and never as `\.self`: the whole
/// snapshot carries SwiftUI's own accessibility state with it, and a cell handed the launch-time
/// snapshot publishes no accessibility for the life of that cell. A reading short enough that no
/// cell is ever recycled was unreadable to a screen reader from launch to teardown (#777).
///
/// Adding an `@Environment` read inside a feed row means adding its value here. Nothing else
/// carries one across, and a missing one reads as the row rendering the framework's defaults.
@MainActor struct FeedCellEnvironment {
    var theme: ArgoTheme = .graphite
    /// The scheme the cell is DRAWN in. A value rather than `preferredColorScheme`, which travels
    /// up to the presentation — twenty cells each asking the window to change scheme is not what
    /// the deck means.
    var colorScheme: ColorScheme = .dark
    /// Read by no row; retires every measured height when it flips.
    var dynamicTypeSize: DynamicTypeSize = .large
    /// What the deck's glass covers at the top of the reading — the coordinator's gutter, not a
    /// row's.
    var deckCanopy: CGFloat = 0
    var stillsMotion = false
    var suppressesTransparency = false
    var agesWait: TimeInterval?
    var waitStarted: Date?
    var openSession: (String) -> Void = { _ in }
    var askAnswering: @MainActor (String, AskAnswer) -> Void = { _, _ in }

    init() {}

    init(_ values: EnvironmentValues) {
        self.theme = values.argo
        self.colorScheme = values.colorScheme
        self.dynamicTypeSize = values.dynamicTypeSize
        self.deckCanopy = values.argoDeckCanopy
        self.stillsMotion = values.argoStillsMotion
        self.suppressesTransparency = values.argoSuppressesTransparency
        self.agesWait = values.argoAgesWait
        self.waitStarted = values.argoWaitStarted
        self.openSession = values.argoOpenSession
        self.askAnswering = values.feedAskAnswering
    }

    /// Whether a cell drawn against the other one would ink differently — the two facts that
    /// re-ink the whole reading and retire its measured heights.
    func reInks(against other: FeedCellEnvironment?) -> Bool {
        colorScheme != other?.colorScheme || dynamicTypeSize != other?.dynamicTypeSize
    }
}

extension View {
    /// The cockpit's environment, replayed into one hosted cell.
    func argoFeedCell(_ environment: FeedCellEnvironment) -> some View {
        argoInk(environment.theme)
            .environment(\.colorScheme, environment.colorScheme)
            .environment(\.dynamicTypeSize, environment.dynamicTypeSize)
            .environment(\.argoStillsMotion, environment.stillsMotion)
            .environment(\.argoSuppressesTransparency, environment.suppressesTransparency)
            .environment(\.argoAgesWait, environment.agesWait)
            .environment(\.argoWaitStarted, environment.waitStarted)
            .environment(\.argoOpenSession, environment.openSession)
            .environment(\.feedAskAnswering, environment.askAnswering)
    }
}
