import ArgoAtoms
import ArgoDesign
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
    /// Point the window at a Ticket the reading names. Beside `openSession` because it is the
    /// same kind of fact: a route out of a row, held by the shell, replayed into a cell.
    var openTicket: (Int) -> Void = { _ in }
    /// Which links in the reading are Tickets, and what Argo calls each. Read by every prose row;
    /// retires every measured height when it moves, because a link worded differently wraps
    /// differently (`FeedMeasureStamp.rewraps(against:)`).
    var tickets: FeedTicketLinks = .none
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
        self.openTicket = values.argoOpenTicket
        self.tickets = values.argoFeedTickets
        self.askAnswering = values.feedAskAnswering
    }

    /// The facts that re-draw the whole reading and retire its measured heights, as one value — so
    /// a store that has to remember what its heights were taken under remembers this rather than
    /// the whole of the environment, which carries a palette and three closures (#858).
    ///
    /// The two scalars were the whole of it until #1178. The Ticket links joined them because they
    /// are the same kind of fact: a link worded as its Ticket is different WORDS, so every row
    /// carrying one wraps differently and stands at a different height.
    struct Setting: Equatable, Sendable {
        let colorScheme: ColorScheme
        let dynamicTypeSize: DynamicTypeSize
        var tickets: FeedTicketLinks = .none
    }

    var setting: Setting {
        Setting(colorScheme: colorScheme, dynamicTypeSize: dynamicTypeSize, tickets: tickets)
    }

    /// Whether a cell drawn against the other one would come out differently.
    func redraws(against other: FeedCellEnvironment?) -> Bool {
        setting != other?.setting
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
            .environment(\.argoOpenTicket, environment.openTicket)
            .environment(\.argoFeedTickets, environment.tickets)
            .environment(\.feedAskAnswering, environment.askAnswering)
    }
}
